
//Cowin Slots prototype V2 - Slack API Bot
// This prototype allows users to ping a whatsapp API bot with the distrcit name
// and it provides you the nearest vaccination slots available near them
// In addition to that, it will notify you when a slot opens up
// created by https://twitter.com/akhiljp_dev

const url = require("url");
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
// Tell express to use the body-parser middleware and to not parse extended bodies
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
dotenv.config();
app.use(
  express.urlencoded({
    extended: true
  })
)
app.use(express.json())

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');


const token = process.env['SLACK_TOKEN'];
const token1 = process.env['SLACK_TOKEN1'];
const cowin_otp_secret = process.env['COWIN_OTP_SECRET'];
const yourcowinnumber = process.env['YOUR_COWIN_NUMBER'];
const otpmsg = {
  secret: cowin_otp_secret,
  mobile: yourcowinnumber
}
console.log(otpmsg)

//keeping this as a global 
let transactionID = "";
let bearertoken ="";
let body = "";

//console.log(token);

const slackWebhookUrl = 'https://hooks.slack.com/services/'+ token; // Your Slack webhook URL
const slackWebhookUrlkol = 'https://hooks.slack.com/services/'+ token1; // Your Slack webhook URL

function sleep(time) {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

//initialize the tables that will be used across these apps
//creating the first table of phone number
var obj = {
  table: []
};
//creating the second table with district ids.
// update this file with the district name and ID mapping
var dist = {
  table: []
};

//Function 2: sendToWA - allows the program to send a message to
// the numbers stored in mynumber.json file. This is the file
// where we are stroing all phone numbers. Can move this to a secure
// repo once we take this to prod
function sendToSlack(message) {
    console.log(slackWebhookUrl);
  return fetch(slackWebhookUrl, {
    body: JSON.stringify({
      text: message,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

function sendToSlackkol(message1) {
  console.log(slackWebhookUrlkol);
return fetch(slackWebhookUrlkol, {
  body: JSON.stringify({
    text: message1,
  }),
  headers: {
    'Content-Type': 'application/json',
  },
  method: 'POST',
});
}


// Function 3: uniq - No idea what this does, need to find out from
//unmag
function uniq(arr) {
  const s = new Set(arr);
  return Array.from(s);
}

//send SMS via AWS SNS system
function sendSMS (message1, phone){
    var params ={
        Message: message1,
        PhoneNumber: phone,
        MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
                DataType: 'String',
                StringValue: 'Transactional'
             }
        }
    }
    var publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();
    publishTextPromise.then(
        function (data) {
          console.log(JSON.stringify({ MessageID: data.MessageId }));
        }).catch(
            function (err) {
                console.log(JSON.stringify({ Error: err }));
            });

}

//extractOTP and get bearer token for API requests
function   extractandvalidateotp(sms, transactionID){
  OTP = sms.match(/(^|[^\d])(\d{6})([^\d]|$)/);
  if (OTP !== null){
    console.log(OTP[2]);
    const hashed = require('crypto').createHash('sha256').update(OTP[2]).digest('hex');
    console.log("this is the hashed otp "+ hashed)
    //now send the confirmOTP API
    let msg = {
      otp: hashed,
      txnId: transactionID
    }
    console.log(JSON.stringify(msg));
    var confirmOTPlink ="https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp";
    return (
      fetch(confirmOTPlink, {
     headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.5',
        //authorization,
        pragma: 'no-cache',
        'Origin': 'https://selfregistration.cowin.gov.in',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:78.0) Gecko/20100101 Firefox/78.0',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(msg)),
      },
      referrer: 'https://selfregistration.cowin.gov.in/appointment',
      method: 'POST',
      body: `{"otp":"${hashed}","txnId":"${transactionID}"}`,
      })
        .then((res) => res.json())
        //.then((res) => console.table(res))
        .then((json) => {
          //sendToSlack("fetch-made");
          //const txid = extractcenters(json);
          //console.log(json.token);
          console.log("This is the bearertoken request response"+JSON.stringify(json))
          bearertoken = json.token;
          console.log("This is inside the validationOTP func="+bearertoken)
          return json.token;
          
        })
        .catch((error) => {
          console.error(error);
          sendToSlack("Couldn't confirm OTP, we no longer have a token to make requests", error);
          //rotateBearerToken();
          return false;
        })
    );

  }
  else {
    return false;
  }
}

//function 4: extractcenters - this helps extract details of centers that has
// available vaccination slots more than 1 or 1
function extractcenters(respjson) {
  let centers = [];
  //console.log(respjson);
  //if you dont find any valid response send back empty
  if (!("centers" in respjson)) {
    return centers;
  }
  centers = respjson.centers.filter((centre) => {
    return centre.sessions.some((session) => session.available_capacity_dose1 >= 1 && session.min_age_limit == 18);
    //return centre.sessions.some((session) => [session.min_age_limit == 18]);
  });
  
  return centers.map((c) => {
    return {
      name: c.name,
      pin: c.pincode,
      vaccines:
        uniq(c.sessions.map((s) => s.vaccine).filter(Boolean)).join(" ") ||
        "Not specified",
      min_age_limit: uniq(c.sessions.map((s) => s.min_age_limit)),
      available_capacity_dose1: uniq(c.sessions.map((s) => s.available_capacity_dose1)),
      dates_available: uniq(c.sessions.map((s) => s.date))
    };
  });
}

function generateOtp(){
  var generateOTPlink ="https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP";
  console.log("This is the JSON blob that wil be sent up "+JSON.stringify(otpmsg));
  return (
    fetch(generateOTPlink, {
   headers: {
      accept: '*/*',
      'accept-language': 'en-US',
      'accept-encoding': 'gzip',
      pragma: 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:78.0) Gecko/20100101 Firefox/78.0',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(otpmsg)),
    },
    referrer: 'https://selfregistration.cowin.gov.in/',
    method: 'POST',
    body: `{"secret":"${cowin_otp_secret}","mobile":${yourcowinnumber}}`,
    })
      .then((res) => res.json())
      //.then((res) => console.table(res))
      .then((json) => {
        //sendToSlack("fetch-made");
        //const txid = extractcenters(json);
        console.log("This is the transaction id from generateOTP func"+
         JSON.stringify(json));
         transactionID = json.txnId;
         console.log("here is just the transaction id " + json.txnId);
        return json.txnId;
      })
      .catch((error) => {
        console.error(error);
        sendToSlack("Couldn't create new OTP, website secret may have changed. Update .env with new secret", error);
        //rotateBearerToken();
        return false;
      })
  );
}


//function 6: check(district) - this function checks the districts users are interested
// and sends them an available slot
function check() {
  //const d1 = new Date(); Need to find a way to forumalte date for API
  //var cowinurl_final =
  // "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=395&date=07-05-2021";
   
  // extract todays date and insert it into the query string
  const d = new Date();
  const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d)
  const mo = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(d)
  const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d)
  format = da + '-' + mo + '-' + ye;
//console.log(format);
  var cowinurl_final =
    "https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=395&date="+format;
  return (
    fetch(cowinurl_final, {
   headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.5',
      authorization: "Bearer " + bearertoken,
      pragma: 'no-cache',
      'If-None-Match': 'W/"7d73-jOVQU+WJSu+sea+wl1HUjfxuNa0',
      'Origin': 'https://selfregistration.cowin.gov.in',
      'User-Agent': 'PostmanRuntime/7.28.0',
    },
    referrer: 'https://selfregistration.cowin.gov.in/appointment',
    body: null,
    method: 'GET',
    mode: 'cors',
    })
      .then((res) => res.json())
      //.then((res) => console.table(res))
      .then((json) => {
        //sendToSlack("fetch-made");
        const slots = extractcenters(json);
        console.log(slots);
        if (slots.length) {
          console.log(slots.length);
          const msg = slots
            .map(
              (s) =>
                `\nPin Code:[${s.pin}] \n${s.name}\nVaccines: ${
                  s.vaccines
                },\nMin Age Limit: ${JSON.stringify(
                  s.min_age_limit
                )},\nAvailable Capacity Dose 1: ${
                  s.available_capacity_dose1
                },\nDates Available: ${s.dates_available}`
            )
            .join("\n");
          console.log("check function is executed");
         

            sendToSlack(`@channel Found slots in Mumbai!\n${msg}\n\n`);
            sendSMS(`Found slots in Mumbai!\n${msg}\n\n`, process.env['YOUR_NUMBER'])
            sendSMS(`Found slots in Mumbai!\n${msg}\n\n`,process.env['BUDDYS_NUMBER'])
        
          //sendToSlack(`@channel Found slots!\n${msg}\n\n`);
          return true;
        } else {
          //sendToSlack(
          //  `No slots found!**********************************************************************************************************************************************************************************************************************************************************************************************************`
         // );

    
          return false;
        }
      })
      .catch((error) => {
        console.error(error);
        sendToSlack("@channel Script errored! 403 error possible. Rotating Bearer Token", error);
        transactionID = generateOtp();
        console.log("here is the txnID" + transactionID);
        return true;

      })
  );
}

function checkthane() {
    //const d1 = new Date(); Need to find a way to forumalte date for API
    //var cowinurl_final =
    // "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=395&date=07-05-2021";
     
    // extract todays date and insert it into the query string
    const d = new Date();
    const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d)
    const mo = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(d)
    const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d)
    format = da + '-' + mo + '-' + ye;
  //console.log(format);
    var cowinurl_final =
      "https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=392&date="+format;
    return (
      fetch(cowinurl_final, {
     headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.5',
        //authorization,
        pragma: 'no-cache',
        'If-None-Match': 'W/"7d73-jOVQU+WJSu+sea+wl1HUjfxuNa0',
        'Origin': 'https://selfregistration.cowin.gov.in',
        'User-Agent': 'PostmanRuntime/7.28.0',
      },
      referrer: 'https://selfregistration.cowin.gov.in/appointment',
      body: null,
      method: 'GET',
      mode: 'cors',
      })
        .then((res) => res.json())
        //.then((res) => console.table(res))
        .then((json) => {
          //sendToSlack("fetch-made");
          const slots = extractcenters(json);
          console.log(slots);
          if (slots.length) {
            console.log(slots.length);
            const msg = slots
              .map(
                (s) =>
                  `\nPin Code:[${s.pin}] \n${s.name}\nVaccines: ${
                    s.vaccines
                  },\nMin Age Limit: ${JSON.stringify(
                    s.min_age_limit
                  )},\nAvailable Capacity: ${
                    s.available_capacity_dose1
                  },\nDates Available: ${s.dates_available}`
              )
              .join("\n");
            console.log("check function is executed");
           
  
              sendToSlack(`@channel Found slots in Thane!\n${msg}\n\n`);
              sendSMS(`Found slots in Thane!\n${msg}\n\n`, process.env['YOUR_NUMBER'])
              sendSMS(`Found slots in Thane!\n${msg}\n\n`,process.env['BUDDYS_NUMBER'])
              
          
            //sendToSlack(`@channel Found slots!\n${msg}\n\n`);
            return true;
          } else {
            //sendToSlack(
            //  `No slots found!**********************************************************************************************************************************************************************************************************************************************************************************************************`
           // );
      
            return false;
          }
        })
        .catch((error) => {
          console.error(error);
          sendToSlack("@channel Script errored! 403 error possible", error);
          return true;
        })
    );
  }

  function checkkolkata() {
    //const d1 = new Date(); Need to find a way to forumalte date for API
    //var cowinurl_final =
    // "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=395&date=07-05-2021";
     
    // extract todays date and insert it into the query string
    const d = new Date();
    const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d)
    const mo = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(d)
    const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d)
    format = da + '-' + mo + '-' + ye;
  //console.log(format);
    var cowinurl_final =
      "https://cdn-api.co-vin.in/api/v2/appointment/sessions/calendarByDistrict?district_id=725&date="+format;
    return (
      fetch(cowinurl_final, {
     headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.5',
        //authorization,
        pragma: 'no-cache',
        'If-None-Match': 'W/"7d73-jOVQU+WJSu+sea+wl1HUjfxuNa0',
        'Origin': 'https://selfregistration.cowin.gov.in',
        'User-Agent': 'PostmanRuntime/7.28.0',
      },
      referrer: 'https://selfregistration.cowin.gov.in/appointment',
      body: null,
      method: 'GET',
      mode: 'cors',
      })
        .then((res) => res.json())
        //.then((res) => console.table(res))
        .then((json) => {
          //sendToSlack("fetch-made");
          const slots = extractcenters(json);
          console.log(slots);
          if (slots.length) {
            console.log(slots.length);
            const msg = slots
              .map(
                (s) =>
                  `\nPin Code:[${s.pin}] \n${s.name}\nVaccines: ${
                    s.vaccines
                  },\nMin Age Limit: ${JSON.stringify(
                    s.min_age_limit
                  )},\nAvailable Capacity: ${
                    s.available_capacity_dose1
                  },\nDates Available: ${s.dates_available}`
              )
              .join("\n");
            console.log("check function is executed");
           
  
              sendToSlackkol(`@channel Found slots in Kolkata!\n${msg}\n\n`);
              //sendSMS(`Found slots in Thane!\n${msg}\n\n`, process.env['YOUR_NUMBER'])
              sendSMS(`Found slots in Kolkata!\n${msg}\n\n`,process.env['BUDDYS1_NUMBER'])
              
          
            //sendToSlack(`@channel Found slots!\n${msg}\n\n`);
            return true;
          } else {
            //sendToSlackkol(
            //  `No slots found!**********************************************************************************************************************************************************************************************************************************************************************************************************`
            //);
      
            return false;
          }
        })
        .catch((error) => {
          console.error(error);
          sendToSlackkol("@channel Script errored! 403 error possible", error);
          return true;
        })
    );
  }

// function 7: main - this is just a heartbeat function that
//checks the status of slots every 5 mins
async function main() {
  while (true) {
    const d = new Date();
    console.log("Checking Mumbai at ", d.toLocaleTimeString());

    const changed = await check();
    //console.log(changed);
    if (changed) {
      console.log("this is the changed walla" + changed);
      await sleep (30000);
    }
    //await sleep (10000);
 /*   const changedthane = await checkthane();
    if (changedthane) {
      await sleep (120000);
    }*/
    //console.log("Checking Kolkata at ", d.toLocaleTimeString());
   /* const changedkol = await checkkolkata();
    if (changedkol) {
      await sleep (120000);
    }*/
  await sleep(10000);
  }
}

// Route that receives a POST request to /sms
app.post('/sms', function (req, res) {
  body = req.body
  console.log(body);
  //getting this SMS to create a new bearertoken;
  beartoken = extractandvalidateotp(body, transactionID);
  console.log("This is happening inside the /sms loop="+beartoken);
  res.set('Content-Type', 'text/plain')
  res.send(`You sent: ${body} to Express`)
})

// Tell our app to listen on port 3000
app.listen(3000, function (err) {
  if (err) {
    throw err
  }
  console.log('Server started on port 3000')

})

main();