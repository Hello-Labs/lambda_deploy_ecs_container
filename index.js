'use strict';
var AWS = require('aws-sdk');
var ecs = new AWS.ECS();

console.log('Loading function');

exports.handler = (event, context, callback) => {
  var codepipeline = new AWS.CodePipeline();
    var jobId = event["CodePipeline.job"].id;
  var putJobSuccess = function(message) {
    var params = {
      jobId: jobId
    };
    codepipeline.putJobSuccessResult(params, function(err, data) {
      if (err) {
        context.fail(err);
      } else {
        context.succeed(message);
      }
    });
  };
  console.log(JSON.stringify(event));
  var eventParams = JSON.parse(event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters);

  console.log(JSON.stringify(eventParams.service));
  var taskParams = {
    taskDefinition: eventParams.taskdef
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
      var image = oldParams.containerDefinitions[0].image;
      console.log(image);
      image = image.substr(0, image.lastIndexOf(":"));
      image += ":" + eventParams.tag;
      console.log(image);
      ecs.registerTaskDefinition(oldParams, function(err, data) {
        if (err) context.fail(err); // an error occurred need to m
        else {
          console.log(data);
          var serviceParams = {
            taskDefinition: eventParams.taskdef,
            cluster: eventParams.cluster,
            service: eventParams.service
          };
          ecs.updateService(serviceParams, function(err, data) {
            if (err) context.fail(err); // an error occurred
            else {
              putJobSuccess(data);
              console.log(data); // successful response
            }

          });

        }
      });
    } // successful response
  });

  callback(null, 'Everything is ok!');
};