class Review:
  
    # Review provided by a customer about their experience.
  
    def __init__(self, reviewID, customerID, rating, comment):
        self.reviewID = reviewID          
        self.customerID = customerID      
        self.rating = rating            
        self.comment = comment            

    def submit(self):
        # Marks the review as submitted.
        return True

    def edit(self, newComment):
        # Allows customer to update their published review.
        self.comment = newComment
