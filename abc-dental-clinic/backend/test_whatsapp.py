import requests

def send_whatsapp_message(phone_number, text_message):
    url = "http://localhost:3000/api/sendText"
    
    # Clean the phone number (remove +, spaces, etc.)
    clean_number = "".join(filter(str.isdigit, phone_number))
    chat_id = f"{clean_number}@c.us"
    
    payload = {
        "chatId": chat_id,
        "text": text_message
    }
    
    try:
        print(f"Sending message to {phone_number}...")
        response = requests.post(url, json=payload)
        data = response.json()
        
        if data.get("success"):
            print("Message sent successfully!")
            return True
        else:
            print("Failed to send message:", data.get("error"))
            return False
    except Exception as e:
        print("Error connecting to the local WhatsApp service:", e)
        return False

if __name__ == "__main__":
    # 🛑 IMPORTANT: Replace this with your actual phone number to test!
    # Make sure to include the country code (e.g., "91" for India, "1" for US)
    # Example: "919876543210"
    TEST_PHONE_NUMBER = "919526406586" 
    
    TEST_MESSAGE = "Hello! This is a test message from your ABC Dental Clinic system!"
    
    if TEST_PHONE_NUMBER == "ENTER_YOUR_NUMBER_HERE":
        print("Please edit test_whatsapp.py and enter your actual phone number on line 29.")
    else:
        send_whatsapp_message(TEST_PHONE_NUMBER, TEST_MESSAGE)
