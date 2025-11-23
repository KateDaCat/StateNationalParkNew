"use strict";

const activityEntries = [];
const MAX_FEED_ITEMS = 6;
const cartItems = [];
const ORDER_STORAGE_KEY = "snparks.orders";
const ORDER_STORAGE_VERSION = 2;
const AUTH_STORAGE_KEY = "snparks.authenticated";
const CANCEL_REASONS = [
  { value: "wrong_destination", label: "I chose the wrong destination" },
  { value: "wrong_time", label: "I chose the wrong date or time" },
  { value: "change_plans", label: "My plans have changed" },
  { value: "payment_issue", label: "Payment or billing issue" },
  { value: "other", label: "Other reason" },
];
let orders = loadOrdersFromStorage();
const DEFAULT_CUSTOMER = {
  id: "CUS-48201",
  name: "Trail Explorer",
  type: "Adventure member",
};
const ADULT_TICKET_PRICE = 45;
const CHILD_TICKET_PRICE = 25;
const CANCELLATION_WINDOW_DAYS = 0;
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
let ordersSortTriggerEl;
let ordersSortMenuEl;
let ordersViewFilter = "upcoming";
let cancelModalEl;
let cancelModalFormEl;
let cancelModalReasonEl;
let cancelModalNotesEl;
let cancelModalCloseBtns;
let cancelModalActiveOrderId = null;
let qrModalEl;
let qrModalCloseBtns;
let qrModalImageEl;
let qrModalInfoEl;
let orderActionsBound = false;
let reviewModalEl;
let reviewOpenBtn;
let reviewCloseBtns;
let reviewStarsEls;
let reviewRatingInput;
let reviewWordCountEl;
let reviewCommentEl;
let reviewPhotosInput;

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
  attachOrderSort();
  attachOrderActionHandlers();
  initReviewModal();
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
  const dateInput = ticketForm?.querySelector('input[name="date"]');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }
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
  if (adults > 0) {
    addItemToCart({
      category: "Ticket",
      label: `${park || "Park"} · Adult ticket`,
      park,
      date,
      time,
      ticketType: "Adult",
      quantity: adults,
      unitPrice: ADULT_TICKET_PRICE,
    });
  }
  if (kids > 0) {
    addItemToCart({
      category: "Ticket",
      label: `${park || "Park"} · Child ticket`,
      park,
      date,
      time,
      ticketType: "Child",
      quantity: kids,
      unitPrice: CHILD_TICKET_PRICE,
    });
  }
}

function initOrders() {
  ordersListEl = document.getElementById("orders-list");
  ordersEmptyEl = document.getElementById("orders-empty");
  ordersListFullEl = document.getElementById("orders-list-full");
  ordersEmptyFullEl = document.getElementById("orders-empty-full");
  ordersSortTriggerEl = document.getElementById("orders-sort-trigger");
  ordersSortMenuEl = document.getElementById("orders-sort-menu");
  const storedView = localStorage.getItem(`${ORDER_STORAGE_KEY}.view`);
  if (storedView === "upcoming" || storedView === "past") {
    ordersViewFilter = storedView;
  }
  renderOrders();
  attachOrdersFilterControls();
}

function renderOrders() {
  renderOrdersInto({
    listEl: ordersListEl,
    emptyEl: ordersEmptyEl,
    limit: 1,
    view: "upcoming",
  });
  renderOrdersInto({
    listEl: ordersListFullEl,
    emptyEl: ordersEmptyFullEl,
    view: ordersViewFilter,
  });
  updateOrdersEmptyFullMessage();
}

function renderOrdersInto({ listEl, emptyEl, limit, view = "upcoming" }) {
  if (!listEl || !emptyEl) return;
  const sorted = getSortedOrders();
  const filtered = filterOrdersByView(sorted, view);
  const entries =
    typeof limit === "number" && Number.isFinite(limit) ? filtered.slice(0, limit) : filtered;
  if (!entries.length) {
    listEl.innerHTML = "";
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";
  listEl.innerHTML = entries.map(renderOrderCard).join("");
}

function updateOrdersEmptyFullMessage() {
  if (!ordersEmptyFullEl) return;
  const titleEl = ordersEmptyFullEl.querySelector("[data-empty-title]");
  const copyEl = ordersEmptyFullEl.querySelector("[data-empty-copy]");
  if (!titleEl || !copyEl) return;
  if (ordersViewFilter === "past") {
    titleEl.textContent = "No past orders yet";
    copyEl.textContent = "Completed or cancelled orders will appear here after their visit date.";
  } else {
    titleEl.textContent = "No upcoming orders";
    copyEl.textContent = "New checkouts and future tickets will appear here.";
  }
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
      ${renderCancellationNote(order)}
      <ul class="order-items">${itemsHtml}</ul>
        <div class="order-footer">
          <span>Total ${formatCurrency(order.total)}</span>
          <div class="order-footer-actions">
            ${
              order.status === "completed"
                ? `<button type="button" class="btn ghost small" data-action="show-qr" data-order-id="${order.id}">Show QR code</button>`
                : ""
            }
            <button type="button" class="btn ghost small" data-action="cancel-order" data-order-id="${order.id}" ${
              isCancellationLocked(order) ? "disabled" : ""
            }>${getCancelButtonLabel(order)}</button>
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
  const orderId = overrides.id || generateOrderId();
  return {
    id: orderId,
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
    qrPayload: overrides.qrPayload || generateQrPayload(orderId),
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
  const hasTickets = orderItems.some((item) => item.category === "Ticket");
  const hasMerch = orderItems.some((item) => item.category === "Merch");
  const firstTicket = orderItems.find((item) => item.category === "Ticket");
  if (hasTickets && firstTicket) {
    const parkName = firstTicket.park || "Park order";
    if (hasMerch) {
      return parkName;
    }
    const parts = [parkName];
    if (firstTicket.date) parts.push(formatDate(firstTicket.date));
    if (firstTicket.time) parts.push(firstTicket.time);
    const summary = parts.filter(Boolean).join(" · ");
    if (summary) {
      return summary;
    }
    return parkName;
  }
  if (!hasTickets && hasMerch) {
    return "Merchandise order";
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
    case "cancel_pending":
      return { label: "Cancellation requested", variant: "warning" };
    case "cancelled":
      return { label: "Cancelled", variant: "danger" };
    default:
      return { label: "Completed", variant: "success" };
  }
}

function loadOrdersFromStorage() {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // legacy payload (v1) — drop to satisfy request to clear test orders
      return [];
    }
    if (!parsed || typeof parsed !== "object") return [];
    if (parsed.version !== ORDER_STORAGE_VERSION || !Array.isArray(parsed.orders)) {
      return [];
    }
    const data = parsed.orders;
      return data.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
      items: (entry.items || []).map((item) => ({ ...item })),
        qrPayload: entry.qrPayload || generateQrPayload(entry.id || generateOrderId()),
      cancellation: entry.cancellation
        ? {
            ...entry.cancellation,
            requestedAt: entry.cancellation.requestedAt
              ? new Date(entry.cancellation.requestedAt)
              : undefined,
            cancelledAt: entry.cancellation.cancelledAt
              ? new Date(entry.cancellation.cancelledAt)
              : undefined,
          }
        : undefined,
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
      cancellation: order.cancellation
        ? {
            ...order.cancellation,
            requestedAt: order.cancellation.requestedAt
              ? new Date(order.cancellation.requestedAt).toISOString()
              : undefined,
            cancelledAt: order.cancellation.cancelledAt
              ? new Date(order.cancellation.cancelledAt).toISOString()
              : undefined,
          }
        : undefined,
    }));
    localStorage.setItem(
      ORDER_STORAGE_KEY,
      JSON.stringify({
        version: ORDER_STORAGE_VERSION,
        orders: payload,
      })
    );
  } catch (error) {
    console.warn("Failed to persist orders", error);
  }
}

function attachOrderSort() {
  const inputs = document.querySelectorAll('input[name="orders-sort"]');
  if (!inputs.length || !ordersSortTriggerEl || !ordersSortMenuEl) return;
  const saved = localStorage.getItem(`${ORDER_STORAGE_KEY}.sort`);
  if (saved) {
    const target = Array.from(inputs).find((input) => input.value === saved);
    if (target) {
      target.checked = true;
    }
  }
  ordersSortTriggerEl.addEventListener("click", () => {
    const isOpen = ordersSortMenuEl.classList.toggle("open");
    ordersSortTriggerEl.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (event) => {
    if (
      !ordersSortMenuEl.contains(event.target) &&
      !ordersSortTriggerEl.contains(event.target)
    ) {
      ordersSortMenuEl.classList.remove("open");
      ordersSortTriggerEl.setAttribute("aria-expanded", "false");
    }
  });
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      localStorage.setItem(`${ORDER_STORAGE_KEY}.sort`, input.value);
      ordersSortMenuEl.classList.remove("open");
      ordersSortTriggerEl.setAttribute("aria-expanded", "false");
      renderOrders();
    });
  });
}

function getSortedOrders() {
  const list = [...orders];
  const selectedInput = document.querySelector('input[name="orders-sort"]:checked');
  const sortMode = selectedInput?.value || "date";
  const compareDateDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  switch (sortMode) {
    case "date-asc":
      return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case "total":
      return list.sort((a, b) => (b.total || 0) - (a.total || 0));
    case "total-asc":
      return list.sort((a, b) => (a.total || 0) - (b.total || 0));
    default:
      return list.sort(compareDateDesc);
  }
}

function filterOrdersByView(list, view = "upcoming") {
  if (view === "past") {
    return list.filter((order) => isOrderPast(order));
  }
  return list.filter((order) => !isOrderPast(order));
}

function attachOrderActionHandlers() {
  if (orderActionsBound) return;
  orderActionsBound = true;
  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action, orderId } = actionButton.dataset;
    if (action === "cancel-order") {
      event.preventDefault();
      if (!orderId) return;
      const targetOrder = orders.find((entry) => entry.id === orderId);
      if (!targetOrder || isCancellationLocked(targetOrder)) return;
      openCancelOrderModal(orderId);
    } else if (action === "show-qr") {
      event.preventDefault();
      if (!orderId) return;
      openOrderQrModal(orderId);
    }
  });
}

function attachOrdersFilterControls() {
  const viewButtons = document.querySelectorAll("[data-orders-view]");
  if (!viewButtons.length) return;
  viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.ordersView === ordersViewFilter);
    button.addEventListener("click", () => {
      const targetView = button.dataset.ordersView;
      if (!targetView || targetView === ordersViewFilter) return;
      ordersViewFilter = targetView;
      localStorage.setItem(`${ORDER_STORAGE_KEY}.view`, ordersViewFilter);
      viewButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
      renderOrders();
    });
  });
}

function openCancelOrderModal(orderId) {
  const modal = ensureCancelOrderModal();
  cancelModalActiveOrderId = orderId;
  if (cancelModalReasonEl) {
    cancelModalReasonEl.value = CANCEL_REASONS[0]?.value || "";
  }
  if (cancelModalNotesEl) {
    cancelModalNotesEl.value = "";
  }
  modal.classList.add("open");
  cancelModalReasonEl?.focus();
}

function closeCancelOrderModal() {
  if (!cancelModalEl) return;
  cancelModalEl.classList.remove("open");
  cancelModalActiveOrderId = null;
}

function ensureCancelOrderModal() {
  if (cancelModalEl) return cancelModalEl;
  const modal = document.createElement("div");
  modal.className = "order-modal";
  modal.innerHTML = `
    <div class="order-modal-backdrop" data-cancel-modal-close></div>
    <div class="order-modal-card" role="dialog" aria-modal="true" aria-labelledby="order-cancel-title">
      <header>
        <h3 id="order-cancel-title">Cancel order</h3>
        <button type="button" class="order-modal-close" aria-label="Close dialog" data-cancel-modal-close>×</button>
      </header>
      <form id="order-cancel-form">
        <label>
          Reason
          <select name="reason" required>
            ${CANCEL_REASONS.map((reason) => `<option value="${reason.value}">${reason.label}</option>`).join("")}
          </select>
        </label>
        <label>
          Additional details (optional)
          <textarea name="notes" rows="3" placeholder="Share more context"></textarea>
        </label>
        <div class="order-modal-actions">
          <button type="button" class="btn ghost" data-cancel-modal-close>Close</button>
          <button type="submit" class="btn primary">Submit cancellation</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  cancelModalEl = modal;
  cancelModalFormEl = modal.querySelector("#order-cancel-form");
  cancelModalReasonEl = cancelModalFormEl?.querySelector("select[name='reason']");
  cancelModalNotesEl = cancelModalFormEl?.querySelector("textarea[name='notes']");
  cancelModalCloseBtns = modal.querySelectorAll("[data-cancel-modal-close]");
  cancelModalCloseBtns.forEach((btn) => btn.addEventListener("click", closeCancelOrderModal));
    cancelModalFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cancelModalActiveOrderId) return;
    const reason = cancelModalReasonEl?.value;
    if (!reason) {
      cancelModalReasonEl?.focus();
      return;
    }
    const notes = cancelModalNotesEl?.value?.trim();
      requestOrderCancellation(cancelModalActiveOrderId, reason, notes);
    closeCancelOrderModal();
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCancelOrderModal();
    }
  });
  return cancelModalEl;
}

function requestOrderCancellation(orderId, reason, notes) {
  const target = orders.find((entry) => entry.id === orderId);
  if (!target || isCancellationLocked(target)) return;
  target.status = "cancel_pending";
  const badge = getOrderStatusBadge("cancel_pending");
  target.statusVariant = badge.variant;
  target.statusLabel = badge.label;
  target.paymentStatus = "Pending refund";
  target.cancellation = {
    status: "requested",
    reason,
    notes,
    requestedAt: new Date(),
  };
  renderOrders();
  saveOrdersToStorage();
}

function formatCancelReason(value) {
  return CANCEL_REASONS.find((reason) => reason.value === value)?.label || "Cancelled";
}

function isCancellationLocked(order) {
  if (order.status === "cancelled" || order.status === "cancel_pending") {
    return true;
  }
  if (order.items?.length) {
    const tickets = order.items.filter((item) => item.category === "Ticket");
    if (tickets.length) {
      const futureTicketExists = tickets.some((ticket) => !isTicketInPast(ticket));
      return !futureTicketExists;
    }
  }
  return false;
}

function getCancelButtonLabel(order) {
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "cancel_pending") return "Cancel pending";
  return isCancellationLocked(order) ? "Cancellation unavailable" : "Cancel order";
}

function renderCancellationNote(order) {
  const info = order.cancellation;
  if (!info) return "";
  if (info.status === "requested" || order.status === "cancel_pending") {
    const requestedAt = info.requestedAt ? formatOrderTimestamp(info.requestedAt) : "recently";
      return `<div class="order-note">
        <strong>Cancellation requested ${escapeHTML(requestedAt)}</strong>
        <small>${escapeHTML(formatCancelReason(info.reason))}${
          info.notes ? ` — ${escapeHTML(info.notes)}` : ""
        } · Refund will be processed once approved.</small>
      </div>`;
  }
  if (info.status === "resolved" || info.cancelledAt || order.status === "cancelled") {
    const cancelledAt = info.cancelledAt ? formatOrderTimestamp(info.cancelledAt) : "recently";
    return `<div class="order-note cancelled">
      <strong>Cancelled ${escapeHTML(cancelledAt)}</strong>
      <small>${escapeHTML(formatCancelReason(info.reason))}${
        info.notes ? ` — ${escapeHTML(info.notes)}` : ""
      }</small>
    </div>`;
  }
  return "";
}

function openOrderQrModal(orderId) {
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) return;
  ensureQrPayload(order);
  const modal = ensureQrModal();
  const qrUrl = getOrderQrUrl(order);
  if (qrModalImageEl) {
    qrModalImageEl.src = qrUrl;
    qrModalImageEl.alt = `QR code for ${order.id}`;
  }
  if (qrModalInfoEl) {
    qrModalInfoEl.textContent = `${order.id} · ${order.summary}`;
  }
  modal.classList.add("open");
}

function ensureQrModal() {
  if (qrModalEl) return qrModalEl;
  const modal = document.createElement("div");
  modal.className = "order-modal";
  modal.innerHTML = `
    <div class="order-modal-backdrop" data-qr-modal-close></div>
    <div class="order-modal-card order-qr-card" role="dialog" aria-modal="true" aria-labelledby="order-qr-title">
      <header>
        <h3 id="order-qr-title">Order QR code</h3>
        <button type="button" class="order-modal-close" aria-label="Close dialog" data-qr-modal-close>×</button>
      </header>
      <div class="order-qr-body">
        <img id="order-qr-image" alt="Order QR code" />
        <p id="order-qr-info" class="muted"></p>
        <small class="muted">Present this code at the park entrance or merchandise counter.</small>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  qrModalEl = modal;
  qrModalImageEl = modal.querySelector("#order-qr-image");
  qrModalInfoEl = modal.querySelector("#order-qr-info");
  qrModalCloseBtns = modal.querySelectorAll("[data-qr-modal-close]");
  qrModalCloseBtns.forEach((btn) => btn.addEventListener("click", closeQrModal));
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeQrModal();
    }
  });
  return qrModalEl;
}

function closeQrModal() {
  if (!qrModalEl) return;
  qrModalEl.classList.remove("open");
}

function ensureQrPayload(order) {
  if (order.qrPayload) return order.qrPayload;
  order.qrPayload = generateQrPayload(order.id);
  saveOrdersToStorage();
  return order.qrPayload;
}

function getOrderQrUrl(order) {
  const payload = encodeURIComponent(ensureQrPayload(order));
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${payload}`;
}

function generateQrPayload(orderId) {
  const randomToken = Math.random().toString(36).slice(2, 10);
  return `snparks://order/${orderId}?token=${randomToken}`;
}

function initReviewModal() {
  reviewModalEl = document.getElementById("review-modal");
  reviewOpenBtn = document.getElementById("review-open-btn");
  const form = document.getElementById("review-form");
  if (!reviewModalEl || !reviewOpenBtn || !form) return;
  reviewCloseBtns = reviewModalEl.querySelectorAll("[data-review-close]");
  reviewStarsEls = Array.from(reviewModalEl.querySelectorAll(".review-star"));
  reviewRatingInput = document.getElementById("review-rating");
  reviewWordCountEl = document.getElementById("review-word-count");
  reviewCommentEl = document.getElementById("review-comment");
  reviewPhotosInput = document.getElementById("review-photos");
  reviewOpenBtn.addEventListener("click", () => openReviewModal());
  reviewCloseBtns.forEach((btn) => btn.addEventListener("click", closeReviewModal));
  reviewModalEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeReviewModal();
    }
  });
  reviewStarsEls.forEach((star) => {
    star.addEventListener("click", () => {
      const value = Number(star.dataset.star);
      setReviewRating(value);
    });
  });
  if (reviewCommentEl) {
    reviewCommentEl.addEventListener("input", handleReviewWordLimit);
  }
  if (reviewPhotosInput) {
    reviewPhotosInput.addEventListener("change", enforceReviewPhotoLimit);
  }
  form.addEventListener("submit", (event) => {
    if (!validateReviewForm()) {
      event.preventDefault();
      return;
    }
    closeReviewModal();
  });
  updateReviewWordCount(0);
}

function openReviewModal() {
  if (!reviewModalEl) return;
  if (reviewRatingInput) {
    reviewRatingInput.value = "0";
    setReviewRating(0);
  }
  if (reviewCommentEl) {
    reviewCommentEl.value = "";
    handleReviewWordLimit();
  }
  if (reviewPhotosInput) {
    reviewPhotosInput.value = "";
  }
  reviewModalEl.classList.add("open");
  reviewModalEl.setAttribute("aria-hidden", "false");
}

function closeReviewModal() {
  if (!reviewModalEl) return;
  reviewModalEl.classList.remove("open");
  reviewModalEl.setAttribute("aria-hidden", "true");
}

function setReviewRating(value) {
  if (!reviewRatingInput || !reviewStarsEls?.length) return;
  reviewStarsEls.forEach((star) => {
    const starValue = Number(star.dataset.star);
    star.classList.toggle("active", starValue <= value);
  });
  reviewRatingInput.value = value;
}

function handleReviewWordLimit() {
  if (!reviewCommentEl) return;
  const maxWords = 100;
  const words = reviewCommentEl.value.trim().split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    reviewCommentEl.value = words.slice(0, maxWords).join(" ");
  }
  updateReviewWordCount(Math.min(words.length, maxWords));
}

function updateReviewWordCount(value) {
  if (reviewWordCountEl) {
    reviewWordCountEl.textContent = String(value);
  }
}

function enforceReviewPhotoLimit(event) {
  const input = event.target;
  if (!input?.files) return;
  if (input.files.length > 3) {
    window.alert("You can attach up to 3 images.");
    input.value = "";
  }
}

function validateReviewForm() {
  const rating = Number(reviewRatingInput?.value || 0);
  if (!rating || rating < 1) {
    window.alert("Please select a star rating.");
    return false;
  }
  const words = reviewCommentEl?.value.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!words.length) {
    window.alert("Please write a short review (up to 100 words).");
    return false;
  }
  return true;
}

function initMockAuthState() {
  const authElements = document.querySelectorAll("[data-auth-visible]");
  const signOutBtn = document.getElementById("nav-signout");
  const signInForm = document.getElementById("signin-form");
  const signUpForm = document.getElementById("signup-form");

  const syncAuthUI = () => {
    const isSignedIn = isUserSignedIn();
    authElements.forEach((element) => {
      const shouldShow =
        element.dataset.authVisible === "signed-in" ? isSignedIn : !isSignedIn;
      element.style.display = shouldShow ? "" : "none";
    });
  };

  signOutBtn?.addEventListener("click", () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    syncAuthUI();
    if (!window.location.pathname.endsWith("homepage.html")) {
      window.location.href = "homepage.html";
    }
  });

  const handleAuthSuccess = () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    window.location.href = "homepage.html#my-orders";
  };

  signInForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthSuccess();
  });

  signUpForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthSuccess();
  });

  syncAuthUI();
}

function isUserSignedIn() {
  return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function isOrderPast(order) {
  if (order.status === "cancel_pending" || order.status === "cancelled") {
    return true;
  }
  const tickets = (order.items || []).filter((item) => item.category === "Ticket");
  if (!tickets.length) {
    return false;
  }
  return tickets.every(isTicketInPast);
}

function isTicketInPast(ticket) {
  if (!ticket || !ticket.date) return false;
  const target = normalizeDate(ticket.date);
  if (!target) return false;
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - CANCELLATION_WINDOW_DAYS);
  return target < threshold;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}
