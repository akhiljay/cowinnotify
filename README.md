# COWIN SMS Real Time Notification system
A SMS bot that sends you a notification when a slot is available in your city real time. It's completely build on top of AWS. AWS Lightsail is used for running the node server, AWS SNS is used to send an SMS text when a slot for the first dose is available for 18-45 range in Mumbai and Thane. In order to get real time slot availability I rely on generating an OTP/token using a burner mobile number. You can augment the code to ping for a different city and enter your phone number to send the SMS alert. 

## Problem Statement
There are two problems with COWIN website and notification bots today. 

a) There are multiple Cowin notification bots on telegram, and I recently discovered that telegram schedules the messages it needs to send out to users. Because of this you end up getting the alert pretty late (>10mins). The Mumbai telegram bot has about 79K+ users subscribed to it and missing the alert by a single minute decreases your chances of getting a slot.
b) The APIs that you hit are public APIs and are cached for 30mins. Even after setting up a private notification server with these public end points, the closest I could get to booking a slot was seeing there were 50 slots in one hospital and by the time I enter the captcha they are gone. After looking at what happened here, I observed that the public APIs are a lot behind when it comes to letting me know of available slots (there were 0 slots remaining when the public API showed that there were 50). 

I hope not everyone needs to setup this bot and the Indian government soon figures a way out to patch the vaccine supply in our country. 

## Steps to run this locally

### Pre-requisites
1. Node and npm needs to be installed 
2. You need to have an AWS account with an IAM user provisioned with AmazonSNSFullAccess permission assigned. 
3. Need to have an Android device with a burner phone number and an IFTT account. 

### Installation Steps

#### Step1 : Setup the server
1. Clone the repo to your local machine "git clone https://github.com/akhiljay/cowinnotify.git"
2. Go to the folder with the index.js "cd cowinnotify"
3. Create a file with your environment variables "touch .env"
4. Edit the .env file with your AWS credentials and the phone number you want to send the SMS alert to - "vi .env"
5. Edit the check() function within the index.js file to request slots for your district. This is the district ID field in the COWIN URL - "vi index.js"

#### Step 2: Setup the IFTT applet
1. Create an account in ifttt.com (A premium paid account is recommended for a quicker response)
2. Create a new applet
3. If this..... click on Android SMS trigger
4. Select "New SMS received matches search" and use CoWIN as the search key
5. Then... Choose a service named Webhooks and then select make a web request
6. Paste the url: https://<IP address of your server>/sms 
7. Method is POST
8. Content Type PlainText
9. Body: Add ingredient and select Text
10. On your android phone, install ifttt app
11. Login to the IFTTT app
12. Ensure that the battery saver mode, and all other optimizations are removed. The appshould always run (This is the key for quick response). Tip: If your IFTTT is not triggered when your SMS is received: https://www.androidpolice.com/2020/05/30/how-to-prevent-apps-sleeping-in-the-background-on-android/ Also a premium account is faster

#### Step 3: Start the server 
1. Run the app "node index.js". You will notice that the server will first generate the OTP, then your android device will forward the OTP to this server, then the server will take that OTP and generate the token needed to access real time availability data. 

## Steps to run this in an automated manner 
1. Visit AWS console and click on Lightsail.
2. Pick the $3.5 per month node instance. 
3. Follow the installation steps provided above. 



