var image = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filterBounds(roi)
    .filterDate('2003-03-01', '2003-04-30')
    .median()
    .clip(roi);
    
Map.centerObject(roi, 10);

Map.addLayer(image,{bands:['SR_B3','SR_B2','SR_B1'],min:0,max:28500},'True');
Map.addLayer(image,{bands:['SR_B4','SR_B3','SR_B2'],min:0,max:28500},'False 1');
// Map.addLayer(image, {bands: ["SR_B5", "SR_B7", "SR_B4"], min: 0, max:28500}, "False 2");
// Map.addLayer(image,{bands:['SR_B4','SR_B1','SR_B2'],min:0,max:28500},'False 3');
// Map.addLayer(image,{bands:['SR_B2','SR_B4','SR_B5'],min:0,max:28500},'False 4');
// Map.addLayer(image,{bands:['SR_B1','SR_B5','SR_B7'],min:0,max:28500},'False 5');

// Merge all training data
var trainingData = water.merge(snow).merge(agri).merge(built).merge(forest).merge(barren);

// Select bands for classification
var bands = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'];

// Prepare the training data
var training = image.select(bands).sampleRegions({
  collection: trainingData,
  properties: ['class'],
  scale: 30
});

// Train the classifier (Random Forest)
var classifier = ee.Classifier.smileRandomForest(100).train({
  features: training,
  classProperty: 'class',
  inputProperties: bands
});

// Classify the image
var classified = image.select(bands).classify(classifier);

// Display the classification result
Map.addLayer(classified, {min: 0, max: 5, palette: ['blue', 'white', 'orange', 'red', 'green', 'yellow']}, 'Classified Image');

// Accuracy Assessment
var validation = training.randomColumn();
var trainSet = validation.filter(ee.Filter.lt('random', 0.8));
var testSet = validation.filter(ee.Filter.gte('random', 0.8));

var trainedClassifier = ee.Classifier.smileRandomForest(100).train({
  features: trainSet,
  classProperty: 'class',
  inputProperties: bands
});

var test = testSet.classify(trainedClassifier);
var confusionMatrix = test.errorMatrix('class', 'classification');

print('Confusion Matrix:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());

// Create an image with both class values and pixel area
var areaImage = ee.Image.pixelArea().addBands(classified);

// Compute area of each class
var classAreas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,  // Group by classified values (second band)
    groupName: 'class'
  }),
  geometry: roi,
  scale: 30,
  maxPixels: 1e13
});

print('Class Areas (sq meters):', classAreas);

// Export the classified image to Google Drive
Export.image.toDrive({
  image: classified,
  description: 'Land_Cover_Classification_1996',
  scale: 30,
  region: roi,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});
