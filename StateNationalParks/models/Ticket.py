from models.OrderItem import OrderItem
from datetime import date

class Ticket(OrderItem):

    # Ticket purchased for park entry.

    def __init__(self, itemID, name, quantity, unitPrice, visitDate, parkName, ticketName, quotaAvailable):
        super().__init__(itemID, name, quantity, unitPrice)
        self.visitDate = visitDate
        self.parkName = parkName
        self.ticketName = ticketName   # safer than ticketType
        self.quotaAvailable = quotaAvailable

    def isRefundable(self):
        # Refund allowed only if visit date is in the future.
        return date.today() < self.visitDate

    def reschedule(self, newDate):
        self.visitDate = newDate
        return True
