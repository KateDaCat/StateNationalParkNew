from datetime import date

class Receipt:
   
    # Receipt generated after a successful payment.
    
    def __init__(self, receiptID, orderID, paymentID):
        self.receiptID = receiptID         
        self.orderID = orderID              
        self.paymentID = paymentID         
        self.dateIssued = date.today()      

    def generate(self):
        # Returns a readable receipt summary.
        return f"Receipt {self.receiptID} for Order {self.orderID}, Payment {self.paymentID}"
