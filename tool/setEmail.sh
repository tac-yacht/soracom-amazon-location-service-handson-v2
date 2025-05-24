#!/bin/bash

if [ $# -ne 1 ];then
    echo "メールアドレスを指定してください"
    exit 1
fi

script_dir=$(cd "$(dirname "$0")" && pwd)
file="$script_dir/../lib/soracom-amazon-location-service-handson-v2-stack.ts"

email="$1"
sed_escaped_email=$(echo "$email" | sed 's/[\!\ \#\$\%\&\*\+\-\/\=\?\^\_\{\|\}\~]/\\&/g; s/\./\\./g')
sed -i.bak "s/YOUR_EMAIL_ADDRESS@example\.jp/$sed_escaped_email/g" "$file"

echo replace result
grep "const notifyReceivedEmail" "$file"
