//Model Selector: Container with all supported models
function ModelSelector(id, onModelsChangedFn) {

  var currentObj = this;
  this.id = id.replace(/\./g,'');
  this.onModelsChangedFn = onModelsChangedFn;
  this.models = [];
  this.$html = $('<div class="modelSelector ' + this.id + '">' +
                  '<h3>MODELS:</h3>' +
                  '<div class="buttonsContainer">' +
                    '<button class="btn btn-info btnGaussian"><i class="fa fa-plus" aria-hidden="true"></i> Gaussian</button>' +
                    '<button class="btn btn-info btnLorentz"><i class="fa fa-plus" aria-hidden="true"></i> Lorentz</button>' +
                  '</div>' +
                  '<div class="modelsContainer">' +
                  '</div>' +
                '</div>');

  this.$html.find(".btnGaussian").click(function () {
    currentObj.addModel(new GaussianModel(currentObj.models.length, currentObj.getRandomColor(), currentObj.onModelsChangedFn));
  });

  this.$html.find(".btnLorentz").click(function () {
    currentObj.addModel(new LorentzModel(currentObj.models.length, currentObj.getRandomColor(), currentObj.onModelsChangedFn));
  });

  this.getRandomColor = function () {
    return '#'+Math.floor(Math.random()*16777215).toString(16);
  }

  this.addModel = function (model){
    this.models.push(model);
    this.$html.find(".modelsContainer").append(model.$html);
    this.onModelsChangedFn();
  }

  this.getModels = function (){
    var models = [];
    for (i in currentObj.models){
      var model = currentObj.models[i].getModel();
      if (!isNull(model)){
        models.push(model);
      }
    }
    return models;
  };

  log ("new ModelSelector id: " + this.id);

  return this;
}


//Model: Base model class
function Model(idx, title, type, color, onModelsChangedFn) {

  var currentObj = this;
  if (isNull(this.id)) {
    this.id = "model_" + idx;
  }
  this.type = type;
  this.idx = idx;
  this.title = title;
  this.color = color;
  this.onModelsChangedFn = onModelsChangedFn;
  this.visible = true;

  this.$html = $('<div class="model ' + this.type + ' ' + this.id + '">' +
                  '<h3 style="color: ' + this.color + '">' +
                    this.title +
                    '<div class="switch-wrapper">' +
                      '<div id="switch_' + this.id + '" class="switch-btn fa fa-minus-square" aria-hidden="true"></div>' +
                    '</div>' +
                  '</h3>' +
                  '<div class="modelContainer">' +
                  '</div>' +
                '</div>');

  //Prepares switchBox
  this.$html.find("#switch_" + this.id).click( function ( event ) {
    currentObj.visible = !currentObj.visible;
    currentObj.onValuesChanged();
    if (currentObj.visible) {
      $(this).switchClass("fa-plus-square", "fa-minus-square");
      currentObj.$html.find(".modelContainer").fadeIn();
    } else {
      $(this).switchClass("fa-minus-square", "fa-plus-square");
      currentObj.$html.find(".modelContainer").fadeOut();
    }
  });

  this.setInputs = function ($inputs) {
    this.$html.find(".modelContainer").append($inputs);
    this.$html.find("input").on('input', this.onValuesChanged);
  }

  this.getModel = function () {
    return null;
  }

  log ("new Model id: " + this.id);

  return this;
}


//Model: Gaussian specific model inherited from Model class
function GaussianModel(idx, color, onModelsChangedFn) {

  var currentObj = this;
  this.id = "gaussian_" + idx;

  this.amplitude = 5.0;
  this.mean = 1.0;
  this.stddev = 0.5;

  Model.call(this,
            idx,
            'Gaussian ' + idx + ':',
            'Gaussian',
            color, onModelsChangedFn);

  this.onValuesChanged = function(){
    try {
      var amplitude = parseFloat(currentObj.$html.find(".inputAmp").val());
      var mean = parseFloat(currentObj.$html.find(".inputMean").val());
      var stddev = parseFloat(currentObj.$html.find(".inputStddev").val());
      if (!isNaN(amplitude) && !isNaN(mean) && !isNaN(stddev)) {
        currentObj.amplitude = amplitude;
        currentObj.mean = mean;
        currentObj.stddev = stddev;
        currentObj.onModelsChangedFn();
      } else {
        log("onValuesChanged, model" + currentObj.id + ", Some value is wrong!!");
      }
    } catch (e) {
      log("onValuesChanged error, model" + currentObj.id + ", error: " + e);
    }
  }

  this.getModel = function () {
    if (this.visible) {
      return { type: "Gaussian", amplitude: this.amplitude, mean: this.mean, stddev: this.stddev, color: this.color };
    }
    return null;
  }

  //Prepares inputs
  this.setInputs($('<p>Amplitude: <input id="amplitude_' + this.id + '" class="inputAmp" type="text" name="amplitude_' + this.id + '" placeholder="' + this.amplitude + '" value="' + this.amplitude + '" /></p>' +
                  '<p>Mean: <input id="mean_' + this.id + '" class="inputMean" type="text" name="mean_' + this.id + '" placeholder="' + this.mean + '" value="' + this.mean + '" /></p>' +
                  '<p>Stddev: <input id="stddev_' + this.id + '" class="inputStddev" type="text" name="stddev_' + this.id + '" placeholder="' + this.stddev + '" value="' + this.stddev + '" /></p>'));


  log ("new GaussianModel id: " + this.id);

  return this;
}


//Model: Lorentz specific model inherited from Model class
function LorentzModel(idx, color, onModelsChangedFn) {

  var currentObj = this;
  this.id = "lorentz_" + idx;

  this.amplitude = 5.0;
  this.x_0 = 1.0;
  this.fwhm = 0.5;

  Model.call(this,
            idx,
            'Lorentz ' + idx + ':',
            'Lorentz',
            color, onModelsChangedFn);

  this.onValuesChanged = function(){
    try {
      var amplitude = parseFloat(currentObj.$html.find(".inputAmp").val());
      var x_0 = parseFloat(currentObj.$html.find(".inputX_0").val());
      var fwhm = parseFloat(currentObj.$html.find(".inputFwhm").val());
      if (!isNaN(amplitude) && !isNaN(x_0) && !isNaN(fwhm)) {
        currentObj.amplitude = amplitude;
        currentObj.x_0 = x_0;
        currentObj.fwhm = fwhm;
        currentObj.onModelsChangedFn();
      } else {
        log("onValuesChanged, model" + currentObj.id + ", Some value is wrong!!");
      }
    } catch (e) {
      log("onValuesChanged error, model" + currentObj.id + ", error: " + e);
    }
  }

  this.getModel = function () {
    if (this.visible) {
      return { type: "Lorentz", amplitude: this.amplitude, x_0: this.x_0, fwhm: this.fwhm, color: this.color };
    }
    return null;
  }

  //Prepares inputs
  this.setInputs($('<p>Amplitude: <input id="amplitude_' + this.id + '" class="inputAmp" type="text" name="amplitude_' + this.id + '" placeholder="' + this.amplitude + '" value="' + this.amplitude + '" /></p>' +
                  '<p>X_0: <input id="x_0_' + this.id + '" class="inputX_0" type="text" name="x_0_' + this.id + '" placeholder="' + this.x_0 + '" value="' + this.x_0 + '" /></p>' +
                  '<p>Fwhm: <input id="fwhm_' + this.id + '" class="inputFwhm" type="text" name="fwhm_' + this.id + '" placeholder="' + this.fwhm + '" value="' + this.fwhm + '" /></p>'));


  log ("new LorentzModel id: " + this.id);

  return this;
}
