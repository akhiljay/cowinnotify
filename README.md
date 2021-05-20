# COWIN SMS Notification system
A SMS bot that sends you a notification when a slot is available in your city. It's completely build on top of AWS. AWS Lightsail is used for running the node server, and AWS SNS is used to send an SMS text when a slot for the first dose is available for 18-45 range in Mumbai and Thane. You can augment the code to ping for a different city and enter your phone number to send the SMS alert. 

## Problem Statement
There are multiple Cowin notification bots on telegram, but I recently discovered that telegram schedules the messages it needs to send out to users. Because of this you actually end up getting the alert pretty late (>10mins). The Mumbai telegram bot has about 79K+ users subscribed to it and missing the alert by a single minute is wasteful. 

I hope not everyone needs to setup this bot and the Indian government soon figures a way out to patch the vaccine supply in our country. 

## Steps to run this locally

### Pre-requisites
1. Node and npm needs to be installed 
2. You need to have an AWS account with an IAM user provisioned with AmazonSNSFullAccess permission assigned. 

### Installation Steps
1. Clone the repo to your local machine "git clone https://github.com/akhiljay/cowinnotify.git"
2. Go to the folder with the index.js "cd cowinnotify"
3. Create a file with your environment variables "touch .env"
4. Edit the .env file with your AWS credentials and the phone number you want to send the SMS alert to - "vi .env"
5. Edit the check() function within the index.js file to request slots for your district. This is the district ID field in the COWIN URL - "vi index.js"
3. Run the app "node index.js"

## Steps to run this in an automated manner 
1. Visit AWS console and click on Lightsail.
2. Pick the $3.5 per month node instance. 
3. Follow the installation steps provided above. 



