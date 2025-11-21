import json
from datetime import date
from models.Order import Order
from models.Ticket import Ticket
from models.Merchandise import Merchandise
from models.Payment import Payment
from models.Receipt import Receipt
from models.Review import Review
from models.Statistic import Statistic

class SystemController:
    """
    Central controller managing:
    - Tickets
    - Merchandise
    - Orders
    - Payments
    - Receipts
    - Reviews
    - Statistics
    """

    def __init__(self):
        # Lists used by system
        self.orderList = []
        self.ticketList = []
        self.merchList = []
        self.reviewList = []
        self.paymentList = []
        self.receiptList = []
        self.statistic = Statistic()

        # JSON file paths
        self.orderFile = "data/orders.json"
        self.ticketFile = "data/tickets.json"
        self.merchFile = "data/merchandise.json"
        self.paymentFile = "data/payments.json"
        self.receiptFile = "data/receipts.json"
        self.reviewFile = "data/reviews.json"
        self.statFile = "data/statistics.json"

        self.loadData()

    # =========================================================
    # LOADING AND SAVING
    # =========================================================
    def loadData(self):
        """Loads lists from JSON files."""
        self.orderList = self._load(self.orderFile)
        self.ticketList = self._load(self.ticketFile)
        self.merchList = self._load(self.merchFile)
        self.paymentList = self._load(self.paymentFile)
        self.receiptList = self._load(self.receiptFile)
        self.reviewList = self._load(self.reviewFile)

        statData = self._load(self.statFile)
        if statData:
            self.statistic.totalOrders = statData.get("totalOrders", 0)
            self.statistic.totalRevenue = statData.get("totalRevenue", 0)

    def saveData(self):
        """Saves lists into JSON files."""
        self._save(self.orderFile, self.orderList)
        self._save(self.ticketFile, self.ticketList)
        self._save(self.merchFile, self.merchList)
        self._save(self.paymentFile, self.paymentList)
        self._save(self.receiptFile, self.receiptList)
        self._save(self.reviewFile, self.reviewList)

        statObj = {
            "totalOrders": self.statistic.totalOrders,
            "totalRevenue": self.statistic.totalRevenue
        }
        self._save(self.statFile, statObj)

    def _load(self, path):
        """Helper function to load JSON safely."""
        try:
            with open(path, "r") as file:
                return json.load(file)
        except:
            return []

    def _save(self, path, data):
        """Helper function to save JSON safely."""
        with open(path, "w") as file:
            json.dump(data, file, indent=4)

    # =========================================================
    # ORDER CREATION
    # =========================================================
    def createOrder(self, customer):
        """Creates a new order."""
        today = str(date.today())
        orderID = f"ORD{len(self.orderList)+1}"

        order = {
            "orderID": orderID,
            "customerID": customer.userID,
            "date": today,
            "status": "active"
        }

        self.orderList.append(order)
        self.saveData()

        return orderID

    # =========================================================
    # PURCHASE TICKET
    # =========================================================
    def purchaseTicket(self, customer, ticketData):
        """Customer buys a ticket."""

        ticket = {
            "itemID": f"T{len(self.ticketList)+1}",
            "name": ticketData["ticketName"],
            "quantity": ticketData["qty"],
            "unitPrice": ticketData["price"],
            "visitDate": ticketData["visitDate"],
            "parkName": ticketData["parkName"],
            "ticketName": ticketData["ticketName"],
            "quotaAvailable": 100
        }

        self.ticketList.append(ticket)

        # Update statistics
        self.statistic.totalOrders += 1
        self.statistic.totalRevenue += ticketData["price"] * ticketData["qty"]

        self.saveData()
        return True

    # =========================================================
    # PURCHASE MERCHANDISE
    # =========================================================
    def purchaseMerch(self, customer, merchData):
        """Customer buys merchandise."""

        merch = {
            "itemID": f"M{len(self.merchList)+1}",
            "name": merchData["name"],
            "quantity": merchData["qty"],
            "unitPrice": merchData["price"],
            "category": merchData["category"],
            "stock": merchData["stock"]
        }

        self.merchList.append(merch)

        self.statistic.totalOrders += 1
        self.statistic.totalRevenue += merchData["price"] * merchData["qty"]

        self.saveData()
        return True

    # =========================================================
    # CANCEL TICKET
    # =========================================================
    def cancelTicket(self, orderID, itemID):
        """Cancels an order."""
        for order in self.orderList:
            if order["orderID"] == orderID:
                order["status"] = "cancelled"
                self.saveData()
                return True
        return False

    # =========================================================
    # REVIEW
    # =========================================================
    def submitReview(self, reviewData):
        """Stores a review."""
        review = {
            "reviewID": f"R{len(self.reviewList)+1}",
            "customerID": reviewData["customerID"],
            "rating": reviewData["rating"],
            "comment": reviewData["comment"]
        }

        self.reviewList.append(review)
        self.saveData()
        return True
