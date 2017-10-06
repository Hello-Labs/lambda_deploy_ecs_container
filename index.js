'use strict';
var AWS = require('aws-sdk');
var ecs = new AWS.ECS();

console.log('Loading function');

exports.handler = (event, context, callback) => {

  console.log(JSON.stringify(event));
  var codepipeline = new AWS.CodePipeline();
  var jobId = event["CodePipeline.job"].id;

  // Notify AWS CodePipeline of a Successful job
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

  // Notify AWS CodePipeline of a failed job
  var putJobFailure = function(message) {
    var params = {
      jobId: jobId,
      failureDetails: {
        message: JSON.stringify(message),
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    };
    codepipeline.putJobFailureResult(params, function(err, data) {
      context.fail(message);
    });
  };

  console.log(JSON.stringify(event));
  var eventParams = JSON.parse(event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters);

  console.log(JSON.stringify(eventParams.service));
  var taskParams = {
    taskDefinition: eventParams.taskdef
  };
  // describeTaskDefinition so we can make a new revision
  ecs.describeTaskDefinition(taskParams, function(err, data) {
    if (err) putJobFailure(err, err.stack); // an error occurred
    else {
      //copy existing taskDefinition
      var oldParams = data.taskDefinition;
      // remove params that aren't accepted
      delete oldParams.taskDefinitionArn;
      delete oldParams.revision;
      delete oldParams.status;
      delete oldParams.requiresAttributes;
      // override the image with the new one. Currenlty its tied to the latest image.
      // TODO setup way to get new image tag from the S3 input artifact
      var image = oldParams.containerDefinitions[0].image;

      image = image.substr(0, image.lastIndexOf(":"));
      image += ":" + eventParams.tag;
      // make the new revision
      ecs.registerTaskDefinition(oldParams, function(err, data) {
        if (err) putJobFailure(err); // an error occurred need to m
        else {
          console.log(JSON.stringify(data));
          var newTaskDef = data.taskDefinition.taskDefinitionArn;
          var serviceParams = {
            taskDefinition: newTaskDef,
            cluster: eventParams.cluster,
            service: eventParams.service
          };

          // Run migrations
          var migrationTask = {
            taskDefinition: newTaskDef,
            cluster: eventParams.cluster,
            overrides: {
              containerOverrides: [{
                name: eventParams.containerName,
                command: [
                  "sh",
                  "-c",
                  "bundle exec rake db:create db:migrate"
                ]
              }]
            },
            placementConstraints: [{
              type: "distinctInstance"
            }],
            placementStrategy: [{
              type: "random"
            }]
          };

          ecs.runTask(migrationTask, function(err, data) {
            if (err) putJobFailure(err.stack); // an error occurred
            else {
              console.log("Running Migrations:" + JSON.stringify(data));
              putJobSuccess(data);
              if (data.failures.length) context.fail(JSON.stringify(data.failures));
              else {
                var params = {
                  cluster: eventParams.cluster,
                  tasks: [
                    data.tasks[0].taskArn
                  ],
                };
                ecs.waitFor('tasksRunning', params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else console.log(data); // successful response
                });
              }
            }
          });
          
          // deploy latest revision to the Service.
          ecs.updateService(serviceParams, function(err, data) {
            if (err) putJobFailure(err.stack); // an error occurred
            else {
              putJobSuccess(data);
              console.log("Service updated: " + JSON.stringify(data));
              var serviceWaitParams = {
                cluster: eventParams.cluster,
                services: [
                  eventParams.service
                ]
              };
              console.log("WaitFor Service to be stable.");
              ecs.waitFor('servicesStable', serviceWaitParams, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else {
                  console.log(data); // successful response
                  callback(null, 'Everything is ok!');
                }
              });

            }

          });

        }
      });
    } // successful response
  });


};
