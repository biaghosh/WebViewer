import smtplib
import random

def send_email(From,To,Subject,Text):
  gmail_user = "byy981109@gmail.com"
  gmail_pwd = "wsuubfjyeptrzaup"
  FROM = From
  TO = To #must be a list
  SUBJECT = Subject
  TEXT = Text
  # Prepare actual message
  message = """\From: %s\nTo: %s\nSubject: %s\n\n%s
  """ % (FROM, ", ".join(TO), SUBJECT, TEXT)
  try:
    #server = smtplib.SMTP(SERVER) 
    server = smtplib.SMTP("smtp.gmail.com", 587) #or port 465 doesn't seem to work!
    server.ehlo()
    server.starttls()
    server.login(gmail_user, gmail_pwd)
    server.sendmail(FROM, TO, message)
    #server.quit()
    server.close()
    print ('successfully sent the mail')
  except:
    print ("failed to send mail")

def generate_random_str():
    num = random.randint(100,1000)
    capa = chr(random.randint(65,90))
    capb = chr(random.randint(65,90))
    low = chr(random.randint(97,122))
    vercode = capa + str(num) + capb + low
    return vercode


def main():
  From = 'byy981109@gmail.com'
  To = ['madhu.gargesha@bioinvision.com']
  Subject = 'Validation Code'
  Text = "This is your validation Code: " + generate_random_str()
  send_email(From,To,Subject,Text)

if __name__=="__main__":
  main()