"use strict";

const modules = [
  {
    name: "AuthManager",
    stereotype: "<<Service>>",
    attributes: ["users: List<User>"],
    operations: [
      "authenticate(username: string, password: string): User",
      "registerUser(customer: Customer): boolean",
      "loadUsers(): void",
      "saveUsers(): void",
    ],
  },
  {
    name: "SystemController",
    stereotype: "<<Coordinator>>",
    attributes: [
      "orderList: List<Order>",
      "ticketList: List<Ticket>",
      "merchList: List<Merchandise>",
    ],
    operations: [
      "createOrder(customer: Customer, order: Order)",
      "purchaseTicket(customer: Customer, ticket: Ticket, qty: int): boolean",
      "purchaseMerch(customer: Customer, merch: Merchandise, qty: int): boolean",
      "refundItem(orderID: string, itemID: string): boolean",
      "loadData(): void / saveData(): void",
    ],
  },
  {
    name: "Statistic",
    stereotype: "<<Data Holder>>",
    attributes: [
      "totalRevenue: double",
      "totalOrders: int",
      "topSellingItem: string",
    ],
    operations: [
      "updateData(order: Order): void",
      "generateReport(): string",
    ],
  },
  {
    name: "Order",
    stereotype: "Entity",
    attributes: [
      "orderID: string",
      "customerID: string",
      "orderDate: LocalDate",
      "status: string",
      "items: List<OrderItem>",
    ],
    operations: [
      "addItem(item: OrderItem): void",
      "removeItem(itemID: string): void",
      "calculateTotal(): double",
      "cancelOrder(): boolean",
      "requestRefund(itemID: string): boolean",
    ],
  },
  {
    name: "OrderItem",
    stereotype: "<<Abstract>>",
    attributes: ["itemID: string", "name: string", "quantity: int", "unitPrice: double"],
    operations: ["calculateSubtotal(): double"],
  },
  {
    name: "Payment",
    stereotype: "Entity",
    attributes: ["paymentID: string", "orderID: string", "amount: double", "status: string"],
    operations: ["processPayment(): boolean"],
  },
  {
    name: "Ticket",
    stereotype: "Entity",
    attributes: ["visitDate: LocalDate", "parkName: string", "ticketType: string", "quotaAvailable: int"],
    operations: ["isRefundable(): boolean", "reschedule(newDate: LocalDate): boolean"],
  },
  {
    name: "Merchandise",
    stereotype: "Entity",
    attributes: ["category: string", "stock: int"],
    operations: ["updateStock(amount: int): void"],
  },
  {
    name: "Receipt",
    stereotype: "<<Data Holder>>",
    attributes: ["receiptID: string", "orderID: string", "paymentID: string", "statusDate: LocalDate"],
    operations: ["generate(): void"],
  },
  {
    name: "Review",
    stereotype: "Entity",
    attributes: ["reviewID: string", "customerID: string", "rating: int", "comment: string"],
    operations: ["submit(): void", "edit(comment: string): void"],
  },
];

const stats = [
  {
    label: "Total revenue",
    value: "$2.4M",
    detail: "Statistic.generateReport() · FY25",
    progress: 82,
  },
  { label: "Orders fulfilled", value: "8,142", detail: "94% completion rate", progress: 74 },
  { label: "Tickets issued", value: "56,320", detail: "avg 660 / day", progress: 68 },
  { label: "Refund requests", value: "134", detail: "<1% of orders", progress: 22 },
];

const orderFlow = [
  {
    icon: "🧾",
    stage: "Create Order",
    desc: "SystemController.createOrder() instantiates Order + Receipt",
  },
  {
    icon: "➕",
    stage: "Add Items",
    desc: "Order.addItem() merges Ticket + Merchandise OrderItems",
  },
  {
    icon: "💳",
    stage: "Process Payment",
    desc: "Payment.processPayment() → Receipt.generate()",
  },
  {
    icon: "📊",
    stage: "Update Statistics",
    desc: "Statistic.updateData(order) recalculates totals",
  },
  {
    icon: "↩️",
    stage: "Request Refund",
    desc: "Order.requestRefund() escalates to Admin moderation",
  },
];

const tickets = [
  { park: "Red Rock Canyon", type: "Explorer Pass", date: "2025-06-21", status: "confirmed" },
  { park: "Silver Lake Basin", type: "Family Bundle", date: "2025-06-24", status: "pending" },
  { park: "Eagle View Ridge", type: "Night Safari", date: "2025-07-02", status: "confirmed" },
  { park: "Mesa Trails", type: "Day Access", date: "2025-07-04", status: "refunded" },
];

const merchandise = [
  { name: "Trail Essentials Kit", category: "Gear", stock: 42, price: "$48" },
  { name: "Summit Insulated Bottle", category: "Hydration", stock: 120, price: "$28" },
  { name: "Topo Canvas Tote", category: "Apparel", stock: 65, price: "$34" },
  { name: "Junior Ranger Workbook", category: "Education", stock: 18, price: "$12" },
];

const activityEntries = [];
let timelineIndex = 0;
let timelineSteps = [];

document.addEventListener("DOMContentLoaded", () => {
  renderModules();
  renderStats();
  renderTickets();
  renderMerch();
  renderTimeline();
  attachFormHandlers();
});

function renderModules() {
  const grid = document.getElementById("module-grid");
  if (!grid) return;

  grid.innerHTML = modules
    .map(
      (mod) => `
      <article class="module-card">
        <header>
          <p class="eyebrow">${mod.stereotype}</p>
          <h3>${mod.name}</h3>
        </header>
        <div>
          <strong>Attributes</strong>
          <ul>${mod.attributes.map((attr) => `<li>${attr}</li>`).join("")}</ul>
        </div>
        <div>
          <strong>Operations</strong>
          <ul>${mod.operations.map((op) => `<li>${op}</li>`).join("")}</ul>
        </div>
      </article>`
    )
    .join("");
}

function renderStats() {
  const grid = document.getElementById("stat-grid");
  if (!grid) return;

  grid.innerHTML = stats
    .map(
      (stat) => `
      <article class="stat-card">
        <p class="muted">${stat.label}</p>
        <strong>${stat.value}</strong>
        <p class="muted">${stat.detail}</p>
        <div class="stat-progress"><span style="width:${stat.progress}%"></span></div>
      </article>`
    )
    .join("");
}

function renderTickets() {
  const tbody = document.getElementById("ticket-table-body");
  if (!tbody) return;

  tbody.innerHTML = tickets
    .map(
      (ticket) => `
      <tr>
        <td>${ticket.park}</td>
        <td>${ticket.type}</td>
        <td>${formatDate(ticket.date)}</td>
        <td><span class="status-pill status-${ticket.status}">${ticket.status}</span></td>
      </tr>`
    )
    .join("");
}

function renderMerch() {
  const grid = document.getElementById("merch-grid");
  if (!grid) return;

  grid.innerHTML = merchandise
    .map(
      (item) => `
      <div class="merch-card">
        <div>
          <strong>${item.name}</strong>
          <p class="muted">${item.category}</p>
        </div>
        <div>
          <p class="muted">Stock ${item.stock}</p>
          <strong>${item.price}</strong>
        </div>
      </div>`
    )
    .join("");
}

function renderTimeline() {
  const container = document.getElementById("order-timeline");
  if (!container) return;

  container.innerHTML = orderFlow
    .map(
      (step, index) => `
      <article class="timeline-step" data-index="${index}">
        <div class="emoji">${step.icon}</div>
        <h4>${step.stage}</h4>
        <p class="muted">${step.desc}</p>
      </article>`
    )
    .join("");

  timelineSteps = Array.from(container.querySelectorAll(".timeline-step"));
  highlightTimeline(0);

  setInterval(() => {
    timelineIndex = (timelineIndex + 1) % orderFlow.length;
    highlightTimeline(timelineIndex);
  }, 4500);
}

function highlightTimeline(activeIndex) {
  timelineSteps.forEach((step, index) => {
    step.classList.toggle("active", index === activeIndex);
  });
}

function attachFormHandlers() {
  const ticketForm = document.getElementById("ticket-form");
  const reviewForm = document.getElementById("review-form");

  if (ticketForm) {
    ticketForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(ticketForm);
      const park = formData.get("park");
      const type = formData.get("type");
      const date = formData.get("date");
      const qty = Number(formData.get("qty"));

      pushActivity({
        type: "Ticket Purchase",
        message: `${qty}× ${type}`,
        meta: `${park} · visit ${formatDate(date)} · SystemController.purchaseTicket()`,
      });

      setActivityMessage("Ticket request queued via SystemController.purchaseTicket().");
      ticketForm.reset();
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
        meta: `${comment.slice(0, 60)}… · Review.submit()`,
      });

      setActivityMessage("Review captured. Admin can moderate via Admin.moderateReview().");
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

  activityEntries.splice(5);

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
