
// Function to return a key value in a specified metadataset
// Inputs: MDS and KEY To search
// Ouput: message to display by bot containing value or error raised
exports.getKeyValue = function(msg) {
  var response = "";
  var args = msg.split(' ');

  const request = require('request');
  const options = {  
    //url: "https://testing.sweagle.com/api/v1/tenant/metadata-parser/parse?mds="+args[0]+"&parser=returnValueforKey&args="+args[1],
    url: "https://testing.sweagle.com/api/v1/tenant/metadata-parser/parse?mds=ansible&parser=returnValueforKey&args=tomcat_user",
    method: "POST",
    headers: {
      "Authorization": "Bearer 34c193df-6de4-4429-972f-c3c1eb691a53"
    }
  };

  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      //console.log(response);
      response = 'In MDS: ' + "" + ', the value for key: ' + "" + ' is: ' + body;
    } else {
      response = 'Sorry, I got an error getting your value: ' + body;
    } 
  });
  return response;
}