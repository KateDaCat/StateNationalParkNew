class Statistic:
   
    # Tracks overall system performance:
    # - total revenue
    # - total number of orders
    # - top-selling item (optional)
  
    def __init__(self):
        self.totalRevenue = 0
        self.totalOrders = 0
        self.topSellingItem = None

    def updateStatistics(self, order):
        # Updates system-wide statistics every time an order is completed.
        self.totalOrders += 1
        self.totalRevenue += order.calculateTotal()

    def generateReport(self):
        # Returns a formatted text summary for display in admin dashboard.
        return f"Total Orders: {self.totalOrders}, Total Revenue: RM{self.totalRevenue}"
