  let currentOrderId = null;
  let currentQR = "";

  // 🌐 Backend URL
  const BASE_URL = "https://campus-delivery-bot.onrender.com";

  // -----------------------------
  // 🛒 Items with Images
  // -----------------------------
  const items = [
    { name: "Pen", img: "images/pen1.jpg" },
    { name: "Notebook", img: "images/notebook.jpg" },
    { name: "Pencil", img: "images/pencil.jpg" },
    { name: "Scissor", img: "images/scissor.jpg" },
    { name: "Marker", img: "images/marker.jpg" },
    { name: "Gum Tape", img: "images/tape.jpg" }
  ];

  // -----------------------------
  // 🧾 Load Items UI
  // -----------------------------
  function loadItems() {
    const container = document.getElementById("itemsContainer");
    if (!container) return;

    container.innerHTML = "";

    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "item";

      div.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${item.img}" width="40" height="40" style="border-radius:8px;" />
          <span>${item.name}</span>
        </div>
        <input type="number" min="0" value="0" id="${item.name}" />
      `;

      container.appendChild(div);
    });
  }

  // Load items if on index page
  if (document.getElementById("itemsContainer")) {
    loadItems();
  }

  // -----------------------------
  // 🧾 Create Order
  // -----------------------------
  async function createOrder() {
    const selectedItems = {};

    // Stationery
    items.forEach(item => {
      const qty = document.getElementById(item.name).value;
      if (qty > 0) selectedItems[item.name] = qty;
    });

    // Electronics
    const customInput = document.getElementById("customComponents").value;
    if (customInput.trim() !== "") {
      selectedItems["Electronic Components"] = customInput;
    }

    // Validation
    if (Object.keys(selectedItems).length === 0) {
      alert("Select items or enter components!");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/order`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ items: selectedItems })
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      currentOrderId = data.order.id;

      document.getElementById("orderInfo").innerText =
        "Order ID: " + currentOrderId;

      currentQR = JSON.stringify({
        order_id: data.order.id,
        token: data.order.token
      });

      // 🧹 Reset inputs
      items.forEach(item => {
        document.getElementById(item.name).value = 0;
      });
      document.getElementById("customComponents").value = "";

    } catch (err) {
      alert("⚠️ Server not responding. Try again.");
      console.error(err);
    }
  }

  // -----------------------------
  // 📱 QR Modal
  // -----------------------------
  function openQR() {
    if (!currentQR) {
      alert("Place order first!");
      return;
    }

    const canvas = document.getElementById("qrcode");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    QRCode.toCanvas(canvas, currentQR);

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
  // 🏪 Go to Admin
  // -----------------------------
  function goToAdmin() {
    window.location.href = "/admin.html";
  }

  // -----------------------------
  // 🏪 Load Orders (Admin)
  // -----------------------------
  async function loadOrders() {
    try {
      const res = await fetch(`${BASE_URL}/orders`);
      const orders = await res.json();
      const isDeliveryActive = orders.some(o => o.status === "delivering");
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
            <td><button 
    onclick="startDelivery(${order.id})"
    ${isDeliveryActive && order.status !== "delivering" ? "disabled" : ""}
  >
    ${order.status === "delivering" ? "In Progress" : (isDeliveryActive ? "Busy" : "Start")}
  </button></td>
          `;
          inProgress.appendChild(row);
          log(`Order ${order.id} active`);
        } else {
          row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.status}</td>
            <td>${order.bot_status}</td>
            <td>${formatItems(order.items)}</td>
          `;
          delivered.appendChild(row);
          log(`Order ${order.id} delivered`);
        }
      });

    } catch (err) {
      console.error("Failed to load orders", err);
    }
  }

  // -----------------------------
  // 🚀 Start Delivery
  // -----------------------------
  async function startDelivery(id) {
    await fetch(`${BASE_URL}/start/${id}`, {
      method: "POST"
    });
    loadOrders();
  }

  // -----------------------------
  // 📜 Logs
  // -----------------------------
  function log(message) {
    const logs = document.getElementById("logs");
    if (!logs) return;

    const time = new Date().toLocaleTimeString();
    logs.innerHTML += `[${time}] ${message}<br>`;
    logs.scrollTop = logs.scrollHeight;
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

  // -----------------------------
  // 🔄 Auto Refresh Admin
  // -----------------------------
  if (document.getElementById("inProgress")) {
    loadOrders();
    setInterval(loadOrders, 3000);
  }

  // -----------------------------
  // ⚡ Wake up backend (Render)
  // -----------------------------
  fetch(`${BASE_URL}/orders`);