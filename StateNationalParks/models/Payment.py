class Payment:
    
    # Represents a payment made for a specific order. A simple success/fail simulation.
    
    def __init__(self, paymentID, orderID, amount, status="success"):
        self.paymentID = paymentID      # Unique ID for payment
        self.orderID = orderID          # Links to Order
        self.amount = amount            # Total amount paid
        self.status = status            # success / failed

    def processPayment(self):
        # Simulates payment processing. For assignment: always returns True as we cannot connect to real banking.
        return True
