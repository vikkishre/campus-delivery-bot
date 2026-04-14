from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid

print("App is starting...")

app = Flask(__name__)
CORS(app)

orders = []
current_order_id = 1

# -------------------------------
# 🧾 Create Order
# -------------------------------
@app.route('/order', methods=['POST'])
def create_order():
    global current_order_id

    data = request.json or {}
    items = data.get("items", {})

    token = str(uuid.uuid4())[:6]

    order = {
        "id": current_order_id,
        "status": "pending",
        "token": token,
        "bot_status": "at_source",
        "items": items
    }

    orders.append(order)
    current_order_id += 1

    return jsonify({
        "message": "Order created",
        "order": order
    })


# -------------------------------
# 📋 Get Orders
# -------------------------------
@app.route('/orders', methods=['GET'])
def get_orders():
    return jsonify(orders)


# -------------------------------
# 🚀 Start Delivery
# -------------------------------
@app.route('/start/<int:order_id>', methods=['POST'])
def start_delivery(order_id):
    for order in orders:
        if order["id"] == order_id:
            order["status"] = "delivering"
            order["bot_status"] = "moving"
            return jsonify({"message": "Delivery started", "order": order})

    return jsonify({"error": "Order not found"}), 404


# -------------------------------
# 📡 Bot Status
# -------------------------------
@app.route('/bot/status', methods=['POST'])
def update_bot_status():
    data = request.json
    order_id = data.get("order_id")
    bot_status = data.get("bot_status")

    for order in orders:
        if order["id"] == order_id:
            order["bot_status"] = bot_status
            return jsonify({"message": "Bot status updated", "order": order})

    return jsonify({"error": "Order not found"}), 404


# -------------------------------
# 📍 Track Order
# -------------------------------
@app.route('/track/<int:order_id>', methods=['GET'])
def track_order(order_id):
    for order in orders:
        if order["id"] == order_id:
            return jsonify({
                "status": order["status"],
                "bot_status": order["bot_status"]
            })

    return jsonify({"error": "Order not found"}), 404


# -------------------------------
# 🔐 QR Verify
# -------------------------------
@app.route('/verify', methods=['POST'])
def verify_qr():
    data = request.json
    order_id = data.get("order_id")
    token = data.get("token")

    for order in orders:
        if order["id"] == order_id and order["token"] == token:
            order["status"] = "delivered"
            return jsonify({
                "message": "Unlocked",
                "success": True
            })

    return jsonify({"success": False}), 400


# -------------------------------
# ▶ Run
# -------------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)