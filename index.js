
//Cowin Slots prototype V2 - Slack API Bot
// This prototype allows users to ping a whatsapp API bot with the distrcit name
// and it provides you the nearest vaccination slots available near them
// In addition to that, it will notify you when a slot opens up
// created by https://twitter.com/akhiljp_dev

const url = require("url");
const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set region
AWS.config.update({region: 'ap-south-1'});



const token = process.env['SLACK_TOKEN'];
console.log(token);

const slackWebhookUrl = 'https://hooks.slack.com/services/'+ token; // Your Slack webhook URL

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


// Function 3: uniq - No idea what this does, need to find out from
//unmag
function uniq(arr) {
  const s = new Set(arr);
  return Array.from(s);
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
    return centre.sessions.some((session) => session.available_capacity >= 1);
  });
  return centers.map((c) => {
    return {
      name: c.name,
      pin: c.pincode,
      vaccines:
        uniq(c.sessions.map((s) => s.vaccine).filter(Boolean)).join(" ") ||
        "Not specified",
      min_age_limit: uniq(c.sessions.map((s) => s.min_age_limit)),
      available_capacity: uniq(c.sessions.map((s) => s.available_capacity)),
      dates_available: uniq(c.sessions.map((s) => s.date))
    };
  });
}

//function 6: check(district) - this function checks the districts users are interested
// and sends them an available slot
function check() {
  //const d1 = new Date(); Need to find a way to forumalte date for API
  //var cowinurl_final =
  // "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=395&date=07-05-2021";

  var cowinurl_final =
    "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByDistrict?district_id=395&date=21-05-2021";
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
      //.then((res) => console.log(res))
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
                  s.available_capacity
                },\nDates Available: ${s.dates_available}`
            )
            .join("\n");
          console.log("check function is executed");
          sendToSlack(`@channel Found slots!\n${msg}\n\n`);
          return true;
        } else {
          sendToSlack(
            `No slots found!**********************************************************************************************************************************************************************************************************************************************************************************************************`
          );


  // Create publish parameters
var params = {
    Message: 'No slots found', /* required */
    PhoneNumber: '+919987956664',
  };
  
  // Create promise and SNS service object
var publishTextPromise = new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();

// Handle promise's fulfilled/rejected states
publishTextPromise.then(
  function(data) {
    console.log("MessageID is " + data.MessageId);
  }).catch(
    function(err) {
    console.error(err, err.stack);
  });
    
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

// function 7: main - this is just a heartbeat function that
//checks the status of slots every 5 mins
async function main() {
  while (true) {
    const d = new Date();
    console.log("Checking at", d.toLocaleTimeString());
    //console.log("Checking at", d.toLocaleTimeString());
    sendToSlack("Checking at : " + d.toLocaleTimeString());
    await check();
    //if (changed) {
    //   break;
    // }
    // sleep for 5 mins
  await sleep(100000);
  }
}

main();