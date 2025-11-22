"use strict";

const activityEntries = [];
const MAX_FEED_ITEMS = 6;
const cartItems = [];
const ORDER_STORAGE_KEY = "snparks.orders";
let orders = loadOrdersFromStorage();
const DEFAULT_CUSTOMER = {
  id: "CUS-48201",
  name: "Trail Explorer",
  type: "Adventure member",
};
const ADULT_TICKET_PRICE = 45;
const CHILD_TICKET_PRICE = 25;
let cartDrawerEl;
let cartButtonEl;
let cartOverlayEl;
let cartCloseBtn;
let cartSummaryEl;
let ticketSummaryEls = {};
let cartSuccessViewEl;
let cartSuccessTotalEl;
let cartSuccessOrderEl;
let ordersListEl;
let ordersEmptyEl;
let ordersListFullEl;
let ordersEmptyFullEl;
let ordersHintEl;
let ordersHintTextEl;
let ordersViewAllBtn;

document.addEventListener("DOMContentLoaded", () => {
  cartDrawerEl = document.getElementById("cart-drawer");
  cartButtonEl = document.getElementById("cart-button");
  cartOverlayEl = document.getElementById("cart-overlay");
  cartCloseBtn = document.getElementById("cart-close");
  cartSummaryEl = document.getElementById("cart-summary");

  attachFormHandlers();
  renderCart();
  attachCartControls();
  attachCheckoutHandler();
  attachMerchButtons();
  attachColorPickers();
  initTicketSummary();
  initOrders();
  attachScrollButtons();
});

function attachFormHandlers() {
  const ticketForm = document.getElementById("ticket-form");
  const cancelForm = document.getElementById("cancel-form");
  const reviewForm = document.getElementById("review-form");

  if (ticketForm) {
    ticketForm.addEventListener("input", updateTicketSummary);
    ticketForm.addEventListener("change", updateTicketSummary);

    ticketForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(ticketForm);
      const park = formData.get("park");
      const date = formData.get("date");
      const time = formData.get("time");
      const adults = Number(formData.get("adults")) || 0;
      const kids = Number(formData.get("kids")) || 0;
      const notes = formData.get("notes")?.trim();
      const ticketLabel = park ? `${park} visit` : "Park ticket";

      const total = calculateTicketPrice(adults, kids);
      const partySummary = `${adults} adult(s) · ${kids} kid(s)`;

      pushActivity({
        type: "Ticket Purchase",
        message: `${ticketLabel} · ${partySummary}`,
        meta: `${park} · ${formatDate(date)} ${time || ""} · ${formatCurrency(total)}${
          notes ? ` · Note: ${notes}` : ""
        }`,
      });

      setActivityMessage("Ticket request queued for processing.");
      addTicketEntriesToCart({
        park,
        date,
        time,
        adults,
        kids,
      });
      ticketForm.reset();
      updateTicketSummary();
    });
    updateTicketSummary();
  }

  if (cancelForm) {
    cancelForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(cancelForm);
      const orderID = formData.get("orderID");
      const ticketID = formData.get("ticketID");
      const action = formData.get("action");
      const reason = formData.get("reason")?.trim();

      pushActivity({
        type: action === "refund" ? "Refund Request" : "Cancellation",
        message: `${orderID} · ticket ${ticketID}`,
        meta: reason ? `Reason: ${reason}` : "No reason provided.",
      });

      setActivityMessage(
        action === "refund"
          ? "Refund request submitted to SystemController.requestRefund()."
          : "Cancellation sent to SystemController.cancelTicket()."
      );
      cancelForm.reset();
    });
  }

  if (reviewForm) {
    reviewForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(reviewForm);
      const rating = formData.get("rating");
      const comment = formData.get("comment");

      pushActivity({
        type: "Review Submitted",
        message: `${rating}★ feedback`,
        meta: `${comment.slice(0, 80)}…`,
      });

      setActivityMessage("Review captured for Admin moderation.");
      reviewForm.reset();
    });
  }
}

function pushActivity(entry) {
  const feed = document.getElementById("activity-feed");
  if (!feed) return;

  activityEntries.unshift({
    ...entry,
    timestamp: new Date(),
  });

  activityEntries.splice(MAX_FEED_ITEMS);

  feed.innerHTML = activityEntries
    .map(
      (item) => `
      <li>
        <strong>${item.type}</strong>
        <div>${item.message}</div>
        <small class="muted">${item.meta}</small>
      </li>`
    )
    .join("");
}

function setActivityMessage(message) {
  const target = document.getElementById("activity-message");
  if (target) {
    target.textContent = message;
  }
}

function addItemToCart(item) {
  const quantity = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? item.total ?? 0;
  const entry = {
    id: `CART-${Date.now().toString().slice(-4)}`,
    ...item,
    quantity,
    unitPrice,
    total: unitPrice * quantity,
  };
  cartItems.unshift(entry);
  cartItems.splice(6);
  renderCart();
  openCartDrawer();
}

function renderCart() {
  const list = document.getElementById("cart-items");
  const count = document.getElementById("cart-count");
  const totalEl = document.getElementById("cart-total");
  const summaryEl = cartSummaryEl;
  if (!list || !count || !totalEl) return;

  if (!cartItems.length) {
    list.innerHTML = '<li class="cart-item muted">Your cart is empty.</li>';
    if (summaryEl) {
      summaryEl.textContent = "No items in cart";
    }
  } else {
    list.innerHTML = cartItems
      .map((item) => {
        const quantityDetail = summarizeCartQuantity(item);
        const colorBadge = renderColorBadge(item);
        return `
        <li class="cart-item">
          <div class="cart-item-row">
            <strong>${item.label}</strong>
            <div class="cart-meta">
              ${colorBadge}
              <span class="cart-chip">${item.category || "Item"}</span>
            </div>
          </div>
          <small class="muted">${describeCartItem(item)}</small>
          ${quantityDetail ? `<small class="muted">${quantityDetail}</small>` : ""}
          <div class="cart-item-row">
            <div class="cart-item-controls" data-id="${item.id}">
              <button type="button" class="cart-item-btn" data-action="decrease" aria-label="Decrease quantity">-</button>
              <span class="cart-qty">Qty ${item.quantity || 1}</span>
              <button type="button" class="cart-item-btn" data-action="increase" aria-label="Increase quantity">+</button>
            </div>
            <div>${formatCurrency(item.unitPrice * item.quantity)}</div>
          </div>
        </li>`;
      })
      .join("");

    if (summaryEl) {
      const ticketCount = cartItems
        .filter((entry) => entry.category === "Ticket")
        .reduce((sum, entry) => sum + (entry.quantity || 0), 0);
      const merchCount = cartItems
        .filter((entry) => entry.category === "Merch")
        .reduce((sum, entry) => sum + (entry.quantity || 0), 0);
      const ticketLabel = `${ticketCount} ticket${ticketCount === 1 ? "" : "s"}`;
      const merchLabel = `${merchCount} merch item${merchCount === 1 ? "" : "s"}`;
      summaryEl.textContent = `${ticketLabel} • ${merchLabel}`;
    }
  }

  const totalItems = cartItems.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  count.textContent = totalItems;
  const total = cartItems.reduce(
    (sum, entry) => sum + (entry.unitPrice || 0) * (entry.quantity || 0),
    0
  );
  totalEl.textContent = formatCurrency(total);
  attachCartItemHandlers();
}

function attachCartControls() {
  if (!cartButtonEl || !cartDrawerEl) return;

  cartButtonEl.addEventListener("click", () => {
    const shouldOpen = !cartDrawerEl.classList.contains("open");
    setCartOpen(shouldOpen);
  });

  if (cartOverlayEl) {
    cartOverlayEl.addEventListener("click", () => setCartOpen(false));
  }

  if (cartCloseBtn) {
    cartCloseBtn.addEventListener("click", () => setCartOpen(false));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setCartOpen(false);
    }
  });
}

function openCartDrawer() {
  setCartOpen(true);
}

function setCartOpen(isOpen) {
  if (!cartDrawerEl || !cartButtonEl) return;
  cartDrawerEl.classList.toggle("open", isOpen);
  cartButtonEl.setAttribute("aria-expanded", String(isOpen));
  if (cartOverlayEl) {
    cartOverlayEl.classList.toggle("open", isOpen);
  }
  if (!isOpen) {
    resetCartSuccessState();
  }
}

function attachCheckoutHandler() {
  if (!cartDrawerEl) return;
  const checkoutButton = cartDrawerEl.querySelector(".cart-footer .btn");
  if (!checkoutButton) return;
  checkoutButton.addEventListener("click", () => {
    if (!cartItems.length) {
      if (cartSummaryEl) {
        cartSummaryEl.textContent = "Add at least one item to checkout.";
      }
      openCartDrawer();
      return;
    }
    showCartPaymentSuccess();
  });
}

function showCartPaymentSuccess() {
  if (!cartDrawerEl || !cartItems.length) return;
  const order = addOrderFromCartItems();
  const successView = ensureCartSuccessView();
  if (!successView) return;
  const total = order?.total ?? 0;
  if (cartSuccessOrderEl) {
    cartSuccessOrderEl.textContent = order?.id || "";
  }
  if (cartSuccessTotalEl) {
    cartSuccessTotalEl.textContent = total ? `${formatCurrency(total)} paid` : "";
  }
  cartDrawerEl.classList.add("success-mode");
  cartItems.length = 0;
  renderCart();
  setCartOpen(true);
  successView.focus();
}

function ensureCartSuccessView() {
  if (cartSuccessViewEl) {
    return cartSuccessViewEl;
  }
  if (!cartDrawerEl) return null;
  const successEl = document.createElement("div");
  successEl.className = "cart-success-state";
  successEl.setAttribute("role", "status");
  successEl.setAttribute("tabindex", "-1");
  successEl.innerHTML = `
    <div class="cart-success-icon" aria-hidden="true">✓</div>
    <p class="cart-success-order" data-success-order></p>
    <h3>Payment successful</h3>
    <p class="muted">Your order is confirmed and already listed in My Orders.</p>
    <p class="cart-success-total" data-success-amount></p>
    <div class="cart-success-actions">
      <button type="button" class="btn primary" data-action="view-orders">View my orders</button>
      <button type="button" class="btn ghost" data-action="close-cart">Close</button>
    </div>
  `;
  cartSuccessOrderEl = successEl.querySelector("[data-success-order]");
  cartSuccessTotalEl = successEl.querySelector("[data-success-amount]");
  const viewOrdersBtn = successEl.querySelector("[data-action='view-orders']");
  const closeBtn = successEl.querySelector("[data-action='close-cart']");
  viewOrdersBtn?.addEventListener("click", () => {
    scrollToSection("my-orders");
    setCartOpen(false);
  });
  closeBtn?.addEventListener("click", () => setCartOpen(false));
  cartDrawerEl.append(successEl);
  cartSuccessViewEl = successEl;
  return cartSuccessViewEl;
}

function resetCartSuccessState() {
  if (!cartDrawerEl || !cartDrawerEl.classList.contains("success-mode")) {
    return;
  }
  cartDrawerEl.classList.remove("success-mode");
  if (cartSuccessOrderEl) {
    cartSuccessOrderEl.textContent = "";
  }
  if (cartSuccessTotalEl) {
    cartSuccessTotalEl.textContent = "";
  }
}

function attachCartItemHandlers() {
  const list = document.getElementById("cart-items");
  if (!list) return;
  list.querySelectorAll(".cart-item-controls").forEach((control) => {
    const id = control.dataset.id;
    control.addEventListener("click", (event) => {
      const button = event.target.closest(".cart-item-btn");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "increase") {
        changeCartItemQuantity(id, 1);
      } else if (action === "decrease") {
        changeCartItemQuantity(id, -1);
      }
    });
  });
}

function changeCartItemQuantity(itemId, delta) {
  const item = cartItems.find((entry) => entry.id === itemId);
  if (!item) return;
  if (delta < 0 && item.quantity === 1) {
    const confirmed = window.confirm("Remove this item from your cart?");
    if (!confirmed) {
      return;
    }
    removeCartItem(itemId);
    return;
  }
  item.quantity = Math.max(1, item.quantity + delta);
  item.total = item.unitPrice * item.quantity;
  renderCart();
}

function removeCartItem(itemId) {
  const index = cartItems.findIndex((entry) => entry.id === itemId);
  if (index === -1) return;
  cartItems.splice(index, 1);
  renderCart();
}

function attachMerchButtons() {
  const buttons = document.querySelectorAll("[data-merch]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.name || "Merchandise";
      const price = Number(button.dataset.price) || 0;
      const description = button.dataset.description || "Park store";
      const card = button.closest(".product-card");
      const colorGroup = card?.querySelector(".color-options");
      const selectedColor = colorGroup?.dataset.selectedColor || "Green";
      const selectedColorHex = colorGroup?.dataset.selectedColorHex || "#15803d";

      addItemToCart({
        category: "Merch",
        label: name,
        park: description,
        quantity: 1,
        unitPrice: price,
        color: selectedColor,
        colorHex: selectedColorHex,
      });
      pushActivity({
        type: "Merchandise Added",
        message: `${name} · ${selectedColor}`,
        meta: `${formatCurrency(price)} · ${description}`,
      });
    });
  });
}

function attachColorPickers() {
  const groups = document.querySelectorAll(".color-options");
  groups.forEach((group) => {
    const dots = Array.from(group.querySelectorAll(".color-dot"));
    if (!dots.length) return;
    const defaultDot = dots.find((dot) => dot.classList.contains("active")) || dots[0];
    const setActiveDot = (target) => {
      dots.forEach((btn) => {
        const isActive = btn === target;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      group.dataset.selectedColor = target.dataset.colorName || "";
      group.dataset.selectedColorHex = target.dataset.colorHex || "";
    };
    setActiveDot(defaultDot);
    dots.forEach((dot) => {
      dot.addEventListener("click", () => setActiveDot(dot));
    });
  });
}

function initTicketSummary() {
  ticketSummaryEls = {
    park: document.getElementById("summary-park"),
    quantity: document.getElementById("summary-quantity"),
    party: document.getElementById("summary-party"),
    date: document.getElementById("summary-date"),
    total: document.getElementById("summary-total"),
  };
  const confirmBtn = document.getElementById("ticket-confirm");
  const ticketForm = document.getElementById("ticket-form");
  if (confirmBtn && ticketForm) {
    confirmBtn.addEventListener("click", () => {
      if (!ticketForm.checkValidity()) {
        ticketForm.reportValidity();
        return;
      }
      ticketForm.requestSubmit();
    });
  }
  updateTicketSummary();
}

function updateTicketSummary() {
  const ticketForm = document.getElementById("ticket-form");
  if (!ticketForm) return;
  const { park, quantity, party, date, total } = ticketSummaryEls;
  if (!park || !quantity || !party || !date || !total) return;
  const data = new FormData(ticketForm);
  const parkName = data.get("park") || "Not selected";
  const adults = Number(data.get("adults")) || 0;
  const kids = Number(data.get("kids")) || 0;
  const visitDate = data.get("date");
  const ticketCount = adults + kids;
  const amount = calculateTicketPrice(adults, kids);

  park.textContent = parkName;
  quantity.textContent = `${ticketCount} ticket${ticketCount === 1 ? "" : "s"}`;
  party.textContent = `${adults} adults · ${kids} kids`;
  date.textContent = visitDate ? formatDate(visitDate) : "Not set";
  total.textContent = formatCurrency(amount);
}

function formatDate(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function calculateTicketPrice(adults, kids) {
  return adults * ADULT_TICKET_PRICE + kids * CHILD_TICKET_PRICE;
}

function describeCartItem(item) {
  if (item.category === "Merch") {
    const details = [];
    if (item.color) details.push(`Color: ${item.color}`);
    if (item.park) details.push(item.park);
    return details.join(" · ") || "Park store";
  }

  const parts = [];
  if (item.park) parts.push(item.park);
  const schedule = [item.date ? formatDate(item.date) : "", item.time || ""].filter(Boolean).join(" ");
  if (schedule) parts.push(schedule.trim());
  return parts.join(" · ") || "Ticket";
}

function renderColorBadge(item) {
  if (!item.color) {
    return "";
  }
  const swatch = item.colorHex || "#15803d";
  return `<span class="cart-color"><span class="cart-color-dot" style="--swatch-color:${swatch}"></span>${item.color}</span>`;
}

function summarizeCartQuantity(item) {
  if (item.category === "Merch") {
    return "";
  }
  if (item.category === "Ticket") {
    const type = item.ticketType || "Ticket";
    return `${type} · 1 pax`;
  }
  const adults = Number.isFinite(item.adults) ? item.adults : 0;
  const kids = Number.isFinite(item.kids) ? item.kids : 0;
  return `${adults} adult(s) / ${kids} kid(s)`;
}

function addTicketEntriesToCart({ park, date, time, adults, kids }) {
  for (let i = 0; i < adults; i += 1) {
    addItemToCart({
      category: "Ticket",
      label: `${park || "Park"} · Adult ticket`,
      park,
      date,
      time,
      ticketType: "Adult",
      quantity: 1,
      unitPrice: ADULT_TICKET_PRICE,
    });
  }
  for (let i = 0; i < kids; i += 1) {
    addItemToCart({
      category: "Ticket",
      label: `${park || "Park"} · Child ticket`,
      park,
      date,
      time,
      ticketType: "Child",
      quantity: 1,
      unitPrice: CHILD_TICKET_PRICE,
    });
  }
}

function initOrders() {
  ordersListEl = document.getElementById("orders-list");
  ordersEmptyEl = document.getElementById("orders-empty");
  ordersListFullEl = document.getElementById("orders-list-full");
  ordersEmptyFullEl = document.getElementById("orders-empty-full");
  ordersHintEl = document.getElementById("orders-hint");
  ordersHintTextEl = document.getElementById("orders-hint-text");
  ordersViewAllBtn = document.getElementById("orders-view-all");
  renderOrders();
}

function renderOrders() {
  renderOrdersInto({
    listEl: ordersListEl,
    emptyEl: ordersEmptyEl,
    limit: 1,
  });
  renderOrdersInto({
    listEl: ordersListFullEl,
    emptyEl: ordersEmptyFullEl,
  });
  const hasOrders = orders.length > 0;
  if (ordersHintEl) {
    ordersHintEl.style.display = hasOrders ? "" : "none";
    if (ordersHintTextEl) {
      ordersHintTextEl.textContent = orders.length > 1 ? "Showing your most recent order." : "Your latest order will appear here.";
    }
  }
  if (ordersViewAllBtn) {
    ordersViewAllBtn.style.display = hasOrders ? "" : "none";
  }
}

function renderOrdersInto({ listEl, emptyEl, limit }) {
  if (!listEl || !emptyEl) return;
  const entries =
    typeof limit === "number" && Number.isFinite(limit) ? orders.slice(0, limit) : orders;
  if (!entries.length) {
    listEl.innerHTML = "";
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";
  listEl.innerHTML = entries.map(renderOrderCard).join("");
}

function renderOrderCard(order) {
  const metaParts = getOrderMetaParts(order);
  const inventorySummary = metaParts.join(" · ") || "No line items";
  const orderDateLabel = formatOrderTimestamp(order.createdAt);
  const paymentBadge = `${order.paymentStatus || "Success"} · ${order.paymentId || ""}`.trim();
  const itemsHtml = order.items
    .map((item) => {
      const qtyLabel = item.quantity > 1 ? `${item.label} ×${item.quantity}` : item.label;
      const categoryClass = item.category === "Ticket" ? "ticket" : item.category === "Merch" ? "merch" : "default";
      return `
        <li class="order-item">
          <div>
            <span class="order-item-chip ${categoryClass}">${escapeHTML(item.category || "Item")}</span>
            <strong>${escapeHTML(qtyLabel)}</strong>
            <small>${escapeHTML(item.meta || "")}</small>
          </div>
          <div class="order-item-amount">${formatCurrency(item.unitPrice * (item.quantity || 1))}</div>
        </li>`;
    })
    .join("");
  return `
    <article class="order-card">
      <header class="order-card-header">
        <div>
          <p class="eyebrow">Order ${escapeHTML(order.id)}</p>
          <h3>${escapeHTML(order.summary)}</h3>
          <p class="muted">Placed ${escapeHTML(orderDateLabel)}</p>
        </div>
        <div class="order-status-group">
          <span class="ticket-status ${order.statusVariant || "success"}">${escapeHTML(order.statusLabel || "Completed")}</span>
          <span class="payment-pill">${escapeHTML(paymentBadge)}</span>
        </div>
      </header>
      <div class="order-meta-grid">
        <div>
          <span>Customer</span>
          <strong>${escapeHTML(order.customerName || "Customer")}</strong>
          <small>ID ${escapeHTML(order.customerId || "N/A")} · ${escapeHTML(order.customerType || "")}</small>
        </div>
        <div>
          <span>Receipt</span>
          <strong>${escapeHTML(order.receiptId || "Pending")}</strong>
          <small>Payment ${escapeHTML(order.paymentId || "Pending")}</small>
        </div>
        <div>
          <span>Contents</span>
          <strong>${order.items.length} item${order.items.length === 1 ? "" : "s"}</strong>
          <small>${escapeHTML(inventorySummary)}</small>
        </div>
      </div>
      <ul class="order-items">${itemsHtml}</ul>
      <div class="order-footer">
        <span>Total ${formatCurrency(order.total)}</span>
        <div class="order-footer-actions">
          <button type="button" class="btn ghost small">Show QR code</button>
          <button type="button" class="btn ghost small">Cancel order</button>
        </div>
      </div>
    </article>
  `;
}

function addOrderFromCartItems() {
  if (!cartItems.length) return null;
  const snapshot = cartItems.map((item) => ({ ...item }));
  const order = createOrderFromItems(snapshot);
  orders.unshift(order);
  renderOrders();
  saveOrdersToStorage();
  return order;
}

function createOrderFromItems(items, overrides = {}) {
  const normalizedItems = combineOrderItems(items);
  const orderItems = normalizedItems.map((item) => ({
    label: item.label || "Item",
    category: item.category || "Item",
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    meta: describeCartItem(item),
    park: item.park,
    date: item.date,
    time: item.time,
  }));
  const total = orderItems.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
  const ticketCount = orderItems
    .filter((entry) => entry.category === "Ticket")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const merchCount = orderItems
    .filter((entry) => entry.category === "Merch")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const status = (overrides.status || "completed").toLowerCase();
  const statusBadge = getOrderStatusBadge(status);
  const paymentStatus =
    overrides.paymentStatus ||
    (status === "refunded" ? "Refunded" : status === "pending" ? "Authorized" : "Success");
  return {
    id: overrides.id || generateOrderId(),
    createdAt: overrides.createdAt ? new Date(overrides.createdAt) : new Date(),
    status,
    statusVariant: overrides.statusVariant || statusBadge.variant,
    statusLabel: overrides.statusLabel || statusBadge.label,
    summary: overrides.summary || buildOrderSummary(orderItems),
    items: orderItems,
    total,
    ticketCount,
    merchCount,
    paymentId: overrides.paymentId || generatePaymentId(),
    paymentStatus,
    receiptId: overrides.receiptId || generateReceiptId(),
    customerId: overrides.customerId || DEFAULT_CUSTOMER.id,
    customerName: overrides.customerName || DEFAULT_CUSTOMER.name,
    customerType: overrides.customerType || DEFAULT_CUSTOMER.type,
  };
}

function combineOrderItems(items) {
  const grouped = new Map();
  items.forEach((entry) => {
    const key = [
      entry.label,
      entry.category,
      entry.park,
      entry.date,
      entry.time,
      entry.color,
      entry.ticketType,
    ]
      .map((value) => value ?? "")
      .join("|");
    const quantity = entry.quantity || 1;
    if (!grouped.has(key)) {
      grouped.set(key, { ...entry, quantity });
    } else {
      grouped.get(key).quantity += quantity;
    }
  });
  return Array.from(grouped.values());
}

function buildOrderSummary(orderItems) {
  const firstTicket = orderItems.find((item) => item.category === "Ticket");
  if (firstTicket) {
    const parts = [];
    if (firstTicket.park) parts.push(firstTicket.park);
    if (firstTicket.date) parts.push(formatDate(firstTicket.date));
    if (firstTicket.time) parts.push(firstTicket.time);
    const summary = parts.filter(Boolean).join(" · ");
    if (summary) {
      return summary;
    }
  }
  if (orderItems.length === 1) {
    return orderItems[0].label;
  }
  return `${orderItems.length} items`;
}

function getOrderMetaParts(order) {
  const parts = [];
  if (order.ticketCount) {
    parts.push(`${order.ticketCount} ticket${order.ticketCount === 1 ? "" : "s"}`);
  }
  if (order.merchCount) {
    parts.push(`${order.merchCount} merch item${order.merchCount === 1 ? "" : "s"}`);
  }
  parts.push(`${order.items.length} line item${order.items.length === 1 ? "" : "s"}`);
  return parts;
}

function generateOrderId() {
  return generatePrefixedId("ORD");
}

function generatePaymentId() {
  return generatePrefixedId("PAY");
}

function generateReceiptId() {
  return generatePrefixedId("RCT");
}

function generatePrefixedId(prefix) {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
}

function formatOrderTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel} · ${timeLabel}`;
}

function attachScrollButtons() {
  const scrollButtons = document.querySelectorAll("[data-scroll-to]");
  scrollButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.scrollTo;
      scrollToSection(targetId);
    });
  });
}

function scrollToSection(sectionId) {
  if (!sectionId) return;
  const target = document.getElementById(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const path = window.location.pathname.endsWith("homepage.html")
    ? `#${sectionId}`
    : `homepage.html#${sectionId}`;
  window.location.href = path;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getOrderStatusBadge(status) {
  switch (status) {
    case "pending":
      return { label: "Pending", variant: "warning" };
    case "refunded":
      return { label: "Refunded", variant: "danger" };
    default:
      return { label: "Completed", variant: "success" };
  }
}

function loadOrdersFromStorage() {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
      items: (entry.items || []).map((item) => ({ ...item })),
    }));
  } catch (error) {
    console.warn("Failed to load order history", error);
    return [];
  }
}

function saveOrdersToStorage() {
  try {
    const payload = orders.map((order) => ({
      ...order,
      createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : undefined,
    }));
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist orders", error);
  }
}
