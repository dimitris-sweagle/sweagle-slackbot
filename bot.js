/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Create a new app via the Slack Developer site:

    -> http://api.slack.com

  Get a Botkit Studio token from Botkit.ai:

    -> https://studio.botkit.ai/

  Run your bot from the command line:

    clientId=<MY SLACK TOKEN> clientSecret=<my client secret> PORT=<3000> studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js

# USE THE BOT:

    Navigate to the built-in login page:

    https://<myhost.com>/login

    This will authenticate you with Slack.

    If successful, your bot will come online and greet you.


# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
var env = require('node-env-file');
env(__dirname + '/.env');


if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
  // process.exit(1);
}

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    // debug: true,
    scopes: ['bot'],
    studio_token: process.env.studio_token,
    studio_command_uri: process.env.studio_command_uri
};

// Use a mongo database if specified, otherwise store in a JSON file local to the app.
// Mongo is automatically configured when deploying to Heroku
if (process.env.MONGO_URI) {
    var mongoStorage = require('botkit-storage-mongo')({mongoUri: process.env.MONGO_URI});
    bot_options.storage = mongoStorage;
} else {
    bot_options.json_file_store = __dirname + '/.data/db/'; // store user data in a simple JSON format
}

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.slackbot(bot_options);

controller.startTicking();

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

if (!process.env.clientId || !process.env.clientSecret) {

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  webserver.get('/', function(req, res){
    res.render('installation', {
      studio_enabled: controller.config.studio_token ? true : false,
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })

  var where_its_at = 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me/';
  console.log('WARNING: This application is not fully configured to work with Slack. Please see instructions at ' + where_its_at);
}else {

  webserver.get('/', function(req, res){
    res.render('index', {
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })
  // Set up a simple storage backend for keeping a record of customers
  // who sign up for the app via the oauth
  require(__dirname + '/components/user_registration.js')(controller);

  // Send an onboarding message when a new team joins
  require(__dirname + '/components/onboarding.js')(controller);

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  // enable advanced botkit studio metrics
  require('botkit-studio-metrics')(controller);

  var normalizedPath = require("path").join(__dirname, "skills");
  require("fs").readdirSync(normalizedPath).forEach(function(file) {
    require("./skills/" + file)(controller);
  });

  // XXX START SPECIFIC PART HERE XXX

  controller.hears('hello','direct_mention,direct_message', function(bot, message) {
    bot.reply(message,'Hello !\nHow can I help you today ?');
  });
  
  controller.hears('tacos','direct_mention,direct_message', function(bot, message) {
    bot.startConversation(message, function(err, convo) {
    convo.say('Oh boy, taco time!');
    convo.ask('What type of taco do you want?', function(answer, convo) {
      var taco_type = answer.text;
      // do something with this answer!
      // storeTacoType(convo.context.user, taco_type);
      convo.say('YUMMMM!!!'); // add another reply
      convo.next(); // continue with conversation
    });
  });
});
  
  controller.on('slash_command',function(bot,message) {
    // reply to slash command
    //var sweagle = require(__dirname + '/components/sweagle/sweagle_commands.js')(message.text);
    var args = message.text.split(' ');
    var response = "";
    switch (message.command) {
      case '/getkeyvalue':
        if (args.length < 2) {
          bot.replyPrivate(message,'You did not provide enough arguments, please provide MDS and KEY');      
        } else {
          const request = require('request');
          const options = {  
            url: "https://testing.sweagle.com/api/v1/tenant/metadata-parser/parse?mds=" + args[0] + "&parser=returnValueforKey&args=" + args[1],
            method: "POST",
            headers: {
              "Authorization": "Bearer 34c193df-6de4-4429-972f-c3c1eb691a53"
            }
          };

          request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              //console.log(response);
              bot.replyPrivate(message, 'In MDS: ' + args[0] + ', the value for key: ' + args[1] + ' is: ' + body);
            } else {
              bot.replyPrivate(message, 'Sorry, I got an error getting your value: ' + body);
            } 
          });          
          //response = sweagle.getKeyValue();
        }       
        break;
        
      default:
        bot.replyPrivate(message, "Sorry, I don't know your command: " + message.command);             
    }
    
  })
  
  // XXX END SPECIFIC PART HERE XXX

  
  // This captures and evaluates any message sent to the bot as a DM
  // or sent to the bot in the form "@bot message" and passes it to
  // Botkit Studio to evaluate for trigger words and patterns.
  // If a trigger is matched, the conversation will automatically fire!
  // You can tie into the execution of the script using the functions
  // controller.studio.before, controller.studio.after and controller.studio.validate
  if (process.env.studio_token) {
      controller.on('direct_message,direct_mention,mention', function(bot, message) {
          controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(function(convo) {
              if (!convo) {
                  // no trigger was matched
                  // If you want your bot to respond to every message,
                  // define a 'fallback' script in Botkit Studio
                  // and uncomment the line below.
                  // controller.studio.run(bot, 'fallback', message.user, message.channel);
              } else {
                  // set variables here that are needed for EVERY script
                  // use controller.studio.before('script') to set variables specific to a script
                  convo.setVar('current_time', new Date());
              }
          }).catch(function(err) {
              bot.reply(message, 'I experienced an error with a request to Botkit Studio: ' + err);
              debug('Botkit Studio: ', err);
          });
      });
  } else {
      console.log('~~~~~~~~~~');
      console.log('NOTE: Botkit Studio functionality has not been enabled');
      console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
  }
}





function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Botkit Starter Kit');
    console.log('Execute your bot application like this:');
    console.log('clientId=<MY SLACK CLIENT ID> clientSecret=<MY CLIENT SECRET> PORT=3000 studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js');
    console.log('Get Slack app credentials here: https://api.slack.com/apps')
    console.log('Get a Botkit Studio token here: https://studio.botkit.ai/')
    console.log('~~~~~~~~~~');
}
