AWS Lambda Function to Deploy ECR Tag to EC2 Container Service
--------

```
aws cloudformation package \
    --template-file /path_to_template/template.yaml \
    --s3-bucket bucket-name \
    --output-template-file packaged-template.yaml
```
