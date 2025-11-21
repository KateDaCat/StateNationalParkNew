"use strict";

const activityEntries = [];
const MAX_FEED_ITEMS = 6;

document.addEventListener("DOMContentLoaded", () => {
  attachFormHandlers();
});

function attachFormHandlers() {
  const ticketForm = document.getElementById("ticket-form");
  const cancelForm = document.getElementById("cancel-form");
  const reviewForm = document.getElementById("review-form");

  if (ticketForm) {
    ticketForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(ticketForm);
      const park = formData.get("park");
      const type = formData.get("type");
      const date = formData.get("date");
      const time = formData.get("time");
      const adults = Number(formData.get("adults")) || 0;
      const kids = Number(formData.get("kids")) || 0;
      const notes = formData.get("notes")?.trim();

      const total = calculateTicketPrice(adults, kids);
      const partySummary = `${adults} adult(s) · ${kids} kid(s)`;

      pushActivity({
        type: "Ticket Purchase",
        message: `${type} · ${partySummary}`,
        meta: `${park} · ${formatDate(date)} ${time || ""} · ${formatCurrency(total)}${
          notes ? ` · Note: ${notes}` : ""
        }`,
      });

      setActivityMessage("Ticket request queued for processing.");
      ticketForm.reset();
    });
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function calculateTicketPrice(adults, kids) {
  const adultPrice = 45;
  const kidPrice = 25;
  return adults * adultPrice + kids * kidPrice;
}
