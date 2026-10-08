from functools import wraps
from flask import Blueprint, request, jsonify, session
from database.connection import get_db_connection, run_query

# Reuses Pavan's pricing table and category-normalization logic so the two
# sides compute the exact same answer, instead of keeping a second copy here
# that could quietly drift out of sync with his.
from routes.move import DEFAULT_SERVICE_PRICES, _category_to_service_key

# Customer side of Move Mode (Member 1): new address + appliance transfer.
# Required-service matching and cost estimation stay in Member 3's routes/move.py;
# they read the appliances saved in move_appliances by /start below.
move_customer_bp = Blueprint("move_customer", __name__, url_prefix="/api/customer/move")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session or session.get("role") != "customer":
            return jsonify({"error": "Login required"}), 401
        return fn(*args, **kwargs)
    return wrapper


def _get_move(move_id, customer_id):
    return run_query(
        "SELECT * FROM move_requests WHERE move_request_id = %s AND customer_id = %s",
        (move_id, customer_id), fetch_one=True,
    )


def _move_appliances(move_id):
    return run_query(
        """SELECT ma.move_appliance_id, ma.appliance_id, ma.required_service_type,
                  a.name, a.category, a.brand, a.model
           FROM move_appliances ma JOIN appliances a ON a.appliance_id = ma.appliance_id
           WHERE ma.move_request_id = %s""",
        (move_id,), fetch=True,
    )


# ---------------------------------------------------------------
# Start a move: new address + appliances to transfer
# ---------------------------------------------------------------

@move_customer_bp.route("/start", methods=["POST"])
@login_required
def start_move():
    """Body: {
        "old_home_id": 1,
        "new_home": {"address", "city", "state", "pincode", "latitude", "longitude", "home_type"},
        "appliance_ids": [1, 2, 3]
    }"""
    customer_id = session["user_id"]
    data = request.get_json(force=True)

    old_home_id = data.get("old_home_id")
    new_home = data.get("new_home") or {}
    appliance_ids = data.get("appliance_ids") or []

    if not old_home_id:
        return jsonify({"error": "old_home_id is required"}), 400
    if not new_home.get("address") or not new_home.get("city"):
        return jsonify({"error": "new_home address and city are required"}), 400
    if not isinstance(appliance_ids, list) or not appliance_ids:
        return jsonify({"error": "Select at least one appliance to move"}), 400

    old_home = run_query(
        "SELECT home_id FROM homes WHERE home_id = %s AND customer_id = %s",
        (old_home_id, customer_id), fetch_one=True,
    )
    if not old_home:
        return jsonify({"error": "Old home not found"}), 404

    appliance_ids = list({int(a) for a in appliance_ids})
    placeholders = ", ".join(["%s"] * len(appliance_ids))
    valid = run_query(
        f"SELECT appliance_id FROM appliances WHERE home_id = %s AND appliance_id IN ({placeholders})",
        tuple([old_home_id] + appliance_ids), fetch=True,
    )
    if len(valid) != len(appliance_ids):
        return jsonify({"error": "Some appliances do not belong to the old home"}), 400

    # One transaction: new home + move request + moved appliances succeed or fail together
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """INSERT INTO homes (customer_id, address, city, state, pincode, latitude, longitude, home_type, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'previous')""",
            (customer_id, new_home["address"], new_home["city"], new_home.get("state"),
             new_home.get("pincode"), new_home.get("latitude"), new_home.get("longitude"),
             new_home.get("home_type", "owned")),
        )
        new_home_id = cur.lastrowid

        cur.execute(
            "INSERT INTO move_requests (customer_id, old_home_id, new_home_id) VALUES (%s, %s, %s)",
            (customer_id, old_home_id, new_home_id),
        )
        move_id = cur.lastrowid

        for appliance_id in appliance_ids:
            cur.execute(
                "INSERT INTO move_appliances (move_request_id, appliance_id) VALUES (%s, %s)",
                (move_id, appliance_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        return jsonify({"error": "Could not create the move request"}), 500
    finally:
        cur.close()
        conn.close()

    return jsonify({
        "message": "Move request created",
        "move_request_id": move_id,
        "new_home_id": new_home_id,
        "appliances": _move_appliances(move_id),
    }), 201


# ---------------------------------------------------------------
# View / track
# ---------------------------------------------------------------

@move_customer_bp.route("", methods=["GET"])
@login_required
def list_moves():
    moves = run_query(
        """SELECT m.move_request_id, m.move_status, m.created_at,
                  oh.address AS old_address, oh.city AS old_city,
                  nh.address AS new_address, nh.city AS new_city
           FROM move_requests m
           JOIN homes oh ON oh.home_id = m.old_home_id
           JOIN homes nh ON nh.home_id = m.new_home_id
           WHERE m.customer_id = %s ORDER BY m.created_at DESC""",
        (session["user_id"],), fetch=True,
    )
    return jsonify(moves)


@move_customer_bp.route("/<int:move_id>", methods=["GET"])
@login_required
def get_move(move_id):
    move = _get_move(move_id, session["user_id"])
    if not move:
        return jsonify({"error": "Move request not found"}), 404
    move["appliances"] = _move_appliances(move_id)
    return jsonify(move)


# ---------------------------------------------------------------
# Cancel / complete
# ---------------------------------------------------------------

@move_customer_bp.route("/<int:move_id>/cancel", methods=["POST"])
@login_required
def cancel_move(move_id):
    move = _get_move(move_id, session["user_id"])
    if not move:
        return jsonify({"error": "Move request not found"}), 404
    if move["move_status"] != "Pending":
        return jsonify({"error": f"A {move['move_status']} move cannot be cancelled"}), 409
    run_query(
        "UPDATE move_requests SET move_status = 'Cancelled' WHERE move_request_id = %s",
        (move_id,), commit=True,
    )
    return jsonify({"message": "Move request cancelled"})


@move_customer_bp.route("/<int:move_id>/complete", methods=["POST"])
@login_required
def complete_move(move_id):
    """Moves the selected appliances into the new home (same appliance_id, so
    service history is preserved) and makes the new home the current one."""
    customer_id = session["user_id"]
    move = _get_move(move_id, customer_id)
    if not move:
        return jsonify({"error": "Move request not found"}), 404
    if move["move_status"] not in ("Pending", "In Progress"):
        return jsonify({"error": f"A {move['move_status']} move cannot be completed"}), 409

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """UPDATE appliances SET home_id = %s
               WHERE appliance_id IN (SELECT appliance_id FROM move_appliances WHERE move_request_id = %s)""",
            (move["new_home_id"], move_id),
        )
        cur.execute("UPDATE homes SET status = 'previous' WHERE customer_id = %s", (customer_id,))
        cur.execute("UPDATE homes SET status = 'current' WHERE home_id = %s", (move["new_home_id"],))
        cur.execute(
            "UPDATE move_requests SET move_status = 'Completed' WHERE move_request_id = %s",
            (move_id,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        return jsonify({"error": "Could not complete the move"}), 500
    finally:
        cur.close()
        conn.close()

    return jsonify({"message": "Move completed", "new_home_id": move["new_home_id"]})


# ---------------------------------------------------------------
# Match required services and write them back onto move_appliances
# ---------------------------------------------------------------
# /start leaves required_service_type null (Member 1's side didn't know the
# required service yet). Pavan's /api/move/required-services and
# /api/move/cost-estimate compute the answer but only return it — nothing
# saves it. This endpoint closes that gap: it reuses his exact pricing table
# and category logic, writes the result onto this move's move_appliances
# rows, and returns the same cost breakdown his /cost-estimate does, so the
# frontend can call this one endpoint instead of three separate ones.

@move_customer_bp.route("/<int:move_id>/match-services", methods=["POST"])
@login_required
def match_required_services(move_id):
    move = _get_move(move_id, session["user_id"])
    if not move:
        return jsonify({"error": "Move request not found"}), 404

    appliances = _move_appliances(move_id)
    if not appliances:
        return jsonify({"error": "This move has no appliances to match"}), 400

    breakdown = []
    total = 0
    for appliance in appliances:
        service_key = _category_to_service_key(appliance["category"])
        price = DEFAULT_SERVICE_PRICES.get(service_key, 300)
        total += price

        run_query(
            "UPDATE move_appliances SET required_service_type = %s WHERE move_appliance_id = %s",
            (service_key, appliance["move_appliance_id"]), commit=True,
        )
        breakdown.append({
            "appliance_id": appliance["appliance_id"],
            "name": appliance["name"],
            "category": appliance["category"],
            "required_service": service_key,
            "estimated_price": price,
        })

    return jsonify({
        "move_request_id": move_id,
        "breakdown": breakdown,
        "estimated_total": total,
    })
