from abc import ABC

class OrderItem(ABC):

    #Abstract parent class for Ticket and Merchandise. Represents a single purchased item.

    def __init__(self, itemID, name, quantity, unitPrice):
        self.itemID = itemID
        self.name = name
        self.quantity = quantity
        self.unitPrice = unitPrice

    def calculateSubtotal(self):
        # Returns total price for this item.
        return self.quantity * self.unitPrice
