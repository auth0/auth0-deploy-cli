#!/bin/bash

# Script providing insight into the progress of migrating Deploy CLI source code to Typescript. See: DXCDT-70
# This can be deleted once migration from JS => TS is complete

echo "- - - - - Typescript Migration - - - - - -"

locJs=$( (find ./src -name "*.js" -print0 | xargs -0 cat) | wc -l | xargs)
locTs=$( (find ./src -name "*.ts" -print0 | xargs -0 cat) | wc -l | xargs)
totalLoc=$(expr ${locJs} + ${locTs})
percentLocMigrated=$(expr $(expr ${locTs} \* 100) / ${totalLoc})

echo "${locTs} of ${totalLoc} (${percentLocMigrated}%) lines of code migrated to Typescript"

numTsFiles=$(find ./src -name "*.ts" | wc -l | xargs)
numJsFiles=$(find ./src -name "*.js" | wc -l | xargs)
totalNumFiles=$(expr ${numTsFiles} + ${numJsFiles})
percentFilesMigrated=$(expr $(expr ${numTsFiles} \* 100) / ${totalNumFiles})

echo "${numTsFiles} of ${numJsFiles} (${percentFilesMigrated}%) files migrated to Typescript"