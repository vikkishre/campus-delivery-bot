let currentOrderId = null;
let currentQR = "";

// -----------------------------
// 🛒 Items
// -----------------------------
const items = ["Pen", "Notebook", "Pencil", "Eraser", "Marker", "Stapler"];

function loadItems() {
  const container = document.getElementById("itemsContainer");
  if (!container) return;

  container.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <span>${item}</span>
      <input type="number" min="0" value="0" id="${item}" />
    `;

    container.appendChild(div);
  });
}

if (document.getElementById("itemsContainer")) {
  loadItems();
}

// -----------------------------
// 🧾 Create Order
// -----------------------------
async function createOrder() {
  const selectedItems = {};

  items.forEach(item => {
    const qty = document.getElementById(item).value;
    if (qty > 0) selectedItems[item] = qty;
  });

  const customInput = document.getElementById("customComponents").value;

  if (customInput.trim() !== "") {
    selectedItems["Electronic Components"] = customInput;
  }

  if (Object.keys(selectedItems).length === 0) {
    alert("Select items or enter components!");
    return;
  }

  const res = await fetch("https://campus-delivery-bot.onrender.com/order", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ items: selectedItems })
  });

  const data = await res.json();

  currentOrderId = data.order.id;

  document.getElementById("orderInfo").innerText =
    "Order ID: " + currentOrderId;

  currentQR = JSON.stringify({
    order_id: data.order.id,
    token: data.order.token
  });
}

// -----------------------------
// 📱 QR Modal
// -----------------------------
function openQR() {
  if (!currentQR) {
    alert("Place order first!");
    return;
  }

  QRCode.toCanvas(document.getElementById("qrcode"), currentQR);
  document.getElementById("qrModal").style.display = "flex";
}

function closeQR() {
  document.getElementById("qrModal").style.display = "none";
}

// -----------------------------
// 📍 Tracking
// -----------------------------
function goToTracking() {
  localStorage.setItem("orderId", currentOrderId);
  window.location.href = "track.html";
}

// -----------------------------
// 🏪 Admin
// -----------------------------
async function loadOrders() {
  const res = await fetch("https://campus-delivery-bot.onrender.com/orders");
  const orders = await res.json();

  const inProgress = document.getElementById("inProgress");
  const delivered = document.getElementById("delivered");

  if (!inProgress || !delivered) return;

  inProgress.innerHTML = "";
  delivered.innerHTML = "";

  orders.forEach(order => {
    const row = document.createElement("tr");

    if (order.status !== "delivered") {
      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.status}</td>
        <td>${order.bot_status}</td>
        <td>${formatItems(order.items)}</td>
        <td><button onclick="startDelivery(${order.id})">Start</button></td>
      `;
      inProgress.appendChild(row);
    } else {
      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.status}</td>
        <td>${order.bot_status}</td>
        <td>${formatItems(order.items)}</td>
      `;
      delivered.appendChild(row);
    }
  });
}

async function startDelivery(id) {
  await fetch(`https://campus-delivery-bot.onrender.com/start/${id}`, {
    method: "POST"
  });
  loadOrders();
}

// -----------------------------
// 📦 Format Items
// -----------------------------
function formatItems(items) {
  if (!items) return "None";

  return Object.entries(items)
    .map(([item, qty]) =>
      typeof qty === "number"
        ? `${item} (x${qty})`
        : `${item}: ${qty}`
    )
    .join(", ");
}
function goToAdmin() {
  window.location.href = "admin.html";
}