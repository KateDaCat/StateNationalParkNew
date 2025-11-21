class Order:
    
    # Order contains a list of purchased items (tickets / merchandise).
  
    def __init__(self, orderID, customerID, orderDate, status="pending"):
        self.orderID = orderID
        self.customerID = customerID
        self.orderDate = orderDate
        self.status = status
        self.items = []       # List of OrderItem objects

    def addItem(self, item):
        # Add a purchased item to the order.
        self.items.append(item)

    def removeItem(self, itemID):
        # Remove item by ID.
        self.items = [i for i in self.items if i.itemID != itemID]

    def calculateTotal(self):
        # Calculate total cost of order.
        return sum([i.calculateSubtotal() for i in self.items])

    def cancelOrder(self):
        self.status = "cancelled"
        return True

    def requestRefund(self, itemID):
        # Refund logic handled in SystemController.
        return True
