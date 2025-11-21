from models.OrderItem import OrderItem

class Merchandise(OrderItem):
   
    # Merchandise item (souvenir, shirt, drinks, etc).

    def __init__(self, itemID, name, quantity, unitPrice, category, stock):
        super().__init__(itemID, name, quantity, unitPrice)
        self.category = category
        self.stock = stock

    def updateStock(self, amount):
       # Increase or decrease available stock.
        self.stock += amount
