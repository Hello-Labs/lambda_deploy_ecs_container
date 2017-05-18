'use strict';
var AWS = require('aws-sdk');
var ecs = new AWS.ECS();

console.log('Loading function');

exports.handler = (event, context, callback) => {
  console.log("Invocation with event =", event);
  var taskParams = {
    taskDefinition: event.taskdef
  };
  ecs.describeTaskDefinition(taskParams, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      console.log(JSON.stringify(data));
      //copy existing taskDefinition
      var oldParams = data.taskDefinition;
      // remove params that aren't accepted
      delete oldParams.taskDefinitionArn;
      delete oldParams.revision;
      delete oldParams.status;
      delete oldParams.requiresAttributes;
      ecs.registerTaskDefinition(oldParams, function(err, data) {
        if (err) console.error(err, JSON.stringify(err.stack)); // an error occurred need to m
        else {
          console.log(data);
          var serviceParams = {
            taskDefinition: event.taskdef,
            cluster: event.cluster,
            service: event.service
          };
          ecs.updateService(serviceParams, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {
              console.log(data); // successful response
            }
          });
        }
      });
    } // successful response
  });
  callback(null, 'Everything is ok!');
};