while true; do
    node lib/index.js export -c=config-ESD-29137.json --format=yaml --output_folder=local/ESD-29137
    node lib/index.js import --input_file=./local/ESD-29137/tenant.yaml -c=./config-ESD-29137.json --env=false   
    echo "----------------------------"
    if [ $? -ne 0 ]; then
        break
    fi
done