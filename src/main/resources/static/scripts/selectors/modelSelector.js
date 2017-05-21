//Model Selector: Container with all supported models
function ModelSelector(id, onModelsChangedFn, onFitClickedFn, applyBootstrapFn) {

  var currentObj = this;
  this.id = id.replace(/\./g,'');
  this.onModelsChangedFn = onModelsChangedFn;
  this.onFitClickedFn = onFitClickedFn;
  this.applyBootstrapFn = applyBootstrapFn;

  this.models = [];
  this.$html = $('<div class="modelSelector ' + this.id + '">' +
                  '<h3>MODELS:</h3>' +
                  '<div class="buttonsContainer">' +
                    '<button class="btn btn-info btnGaussian"><i class="fa fa-plus" aria-hidden="true"></i> Gaussian</button>' +
                    '<button class="btn btn-info btnLorentz"><i class="fa fa-plus" aria-hidden="true"></i> Lorentz</button>' +
                    '<button class="btn btn-info btnPowerLaw"><i class="fa fa-plus" aria-hidden="true"></i> PowerLaw</button>' +
                    '<button class="btn btn-info btnBrokenPowerLaw"><i class="fa fa-plus" aria-hidden="true"></i> BrokenPowerLaw</button>' +
                  '</div>' +
                  '<div class="modelsContainer">' +
                  '</div>' +
                  '<div class="actionsContainer">' +
                    '<button class="btn btn-primary fitBtn"><i class="fa fa-line-chart" aria-hidden="true"></i> FIT</button>' +
                    '<button class="btn btn-success applyBtn"><i class="fa fa-check-circle" aria-hidden="true"></i> APPLY ALL</button>' +
                    '<button class="btn btn-danger bootstrapBtn"><i class="fa fa-line-chart" aria-hidden="true"></i> BOOTSTRAP</button>' +
                  '</div>' +
                '</div>');

  this.$html.find(".btnGaussian").click(function () {
    currentObj.addModel(new GaussianModel(currentObj.models.length, currentObj.getRandomColor(), currentObj.onModelsChangedFn));
  });

  this.$html.find(".btnLorentz").click(function () {
    currentObj.addModel(new LorentzModel(currentObj.models.length, currentObj.getRandomColor(), currentObj.onModelsChangedFn));
  });

  this.$html.find(".btnPowerLaw").click(function () {
    currentObj.addModel(new PowerLawModel(currentObj.models.length, currentObj.getRandomColor(), currentObj.onModelsChangedFn));
  });

  this.$html.find(".btnBrokenPowerLaw").click(function () {
    currentObj.addModel(new BrokenPowerLawModel(currentObj.models.length, currentObj.getRandomColor(), currentObj.onModelsChangedFn));
  });

  this.$html.find(".fitBtn").click(function () {
    currentObj.onFitClickedFn();
  }).hide();

  this.$html.find(".applyBtn").click(function () {
    currentObj.applyAllEstimations();
    $(this).hide();
  }).hide();

  this.$html.find(".bootstrapBtn").click(function () {
    currentObj.applyBootstrapFn();
  }).hide();

  this.getRandomColor = function () {
    return '#'+ fillWithZeros(Math.floor(Math.random()*16777215).toString(16), 6);
  }

  this.addModel = function (model){
    if (this.$html.find(".modelsContainer").find(".combinedLbl").length == 0) {
      this.$html.find(".modelsContainer").append('<h3 class="combinedLbl" style="color: ' + CombinedModelColor + '">- Combined Model</h3>');
    }
    this.models.push(model);
    this.$html.find(".modelsContainer").append(model.$html);
    this.$html.find(".fitBtn").show();
    this.onModelsChangedFn();
  }

  this.getModels = function (estimated){
    var models = [];
    for (i in currentObj.models){
      var model = currentObj.models[i].getModel(!isNull(estimated) && estimated);
      if (!isNull(model)){
        models.push(model);
      }
    }

    if (!estimated) {
      if (models.length > 0) {
        currentObj.$html.find(".actionsContainer").show();
      } else {
        currentObj.$html.find(".actionsContainer").hide();
      }
    }

    return models;
  };

  this.setEstimation = function (params, showApplyBtn) {
    var idx = 0;
    var visibleModelsCount = this.getModels().length;
    for (i in this.models){
      if (this.models[i].visible) {
        this.models[i].setEstimation(params, (visibleModelsCount > 1) ? idx : -1);
        idx ++;
      }
    }

    if (idx > 0 && showApplyBtn) {
      this.$html.find(".applyBtn").show();
      this.onModelsChangedFn();
    } else {
      this.$html.find(".applyBtn").hide();
    }
  }

  this.applyAllEstimations = function (){
    for (i in this.models){
      this.models[i].applyEstimations();
    }
    this.$html.find(".bootstrapBtn").show();
    this.onModelsChangedFn();
  };

  this.clearAllEstimationsAndErrors = function (){
    for (i in this.models){
      this.models[i].clearEstimationsAndErrors();
    }
    this.$html.find(".applyBtn").hide();
    this.$html.find(".bootstrapBtn").hide();
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
                  '<div class="container paramContainer">' +
                  '</div>' +
                '</div>');

  //Prepares switchBox
  this.$html.find("#switch_" + this.id).click( function ( event ) {
    currentObj.visible = !currentObj.visible;
    if (!currentObj.onValuesChanged()) { currentObj.onModelsChangedFn(); }
    if (currentObj.visible) {
      $(this).switchClass("fa-plus-square", "fa-minus-square");
      currentObj.$html.find(".paramContainer").fadeIn();
    } else {
      $(this).switchClass("fa-minus-square", "fa-plus-square");
      currentObj.$html.find(".paramContainer").fadeOut();
    }
  });

  this.setInputs = function () {
    var modelParams = this.getParammeters();
    var $paramContainer = this.$html.find(".paramContainer");
    $paramContainer.html("");

    for (p in modelParams){
      var paramName = modelParams[p];

      var $paramHtml = $('<div class="row ' + paramName + '">' +
                            paramName + ':' +
                            '<input id="' + paramName + '_' + this.id + '" class="input_' + paramName + '" type="text" name="' + paramName + '_' + this.id + '" placeholder="' + this[paramName].toFixed(3) + '" value="' + this[paramName].toFixed(3) + '" />' +
                            '<div class="switch-wrapper">' +
                            '  <div id="switch_' + paramName + '_' + this.id + '" param="' + paramName + '" class="switch-btn fa fa-square-o" aria-hidden="true"></div>' +
                            '</div>' +
                          '</div>');

      if (this.isFixedParam(paramName)){
        //If param is fixed, just set it as fixed
        $paramHtml.find(".switch-btn").switchClass("fa-square-o", "fa-check-square-o");
        $paramHtml.find("input").addClass("fixed");
        $paramHtml.find("input").attr("disabled", true);
      } else if (!isNull(this[paramName + "Err"])){
        //If we have errors calculated for this param show it
        var error = this[paramName + "Err"];
        var $errorHtml = $('<div class="error">' +
                              '<div class="err">+/-' + Math.abs(error).toFixed(3) + '</div>' +
                            '</div>');
        $paramHtml.append($errorHtml);

      } else if (!isNull(this[paramName + "Est"])){
        if (this[paramName + "Est"].value != this[paramName]){
          //If the estimation is not applied, shows the estimation near the input
          var estimation = this[paramName + "Est"];
          var $estimationHtml = $('<div class="estimation">' +
                                    '<a href="#" class="applySngBtn" param="' + paramName + '"><i class="fa fa-check-circle" aria-hidden="true"></i></a>' +
                                    '<div class="value">' + estimation.value.toFixed(3) + '</div>' +
                                    '<div class="err">+/-' + estimation.err.toFixed(3) + '</div>' +
                                  '</div>');
          $estimationHtml.find(".applySngBtn").click(function () {
            currentObj.applyEstimation($(this).attr("param"));
            currentObj.setInputs();
            currentObj.onModelsChangedFn();
          });
          $paramHtml.append($estimationHtml);
        }
      }

      //Sets the text as green if has same value that the estimation (applied)
      if (!isNull(this[paramName + "Est"]) && this[paramName + "Est"].value == this[paramName]) {
        $paramHtml.find("input").addClass("applied");
      }

      $paramContainer.append($paramHtml);
    }

    $paramContainer.find("input").on('change', this.onValuesChanged);
    $paramContainer.find(".switch-btn").click( function ( event ) {
      currentObj.switchFixedParam($(this).attr("param"));
      currentObj.onValuesChanged();
      currentObj.setInputs();
    });
  }

  this.onValuesChanged = function(){
    var modelChanged = false;

    try {
      var modelParams = currentObj.getParammeters();
      var paramContainer = currentObj.$html.find(".paramContainer");

      for (p in modelParams){
        var paramName = modelParams[p];
        var value = getInputFloatValue(paramContainer.find(".input_" + paramName), currentObj[paramName]);
        if (currentObj[paramName] != value){
          currentObj[paramName] = value;
          modelChanged = true;
        }
      }

      if (modelChanged) {
        currentObj.onModelsChangedFn();
      }

    } catch (e) {
      log("onValuesChanged error, model" + currentObj.id + ", error: " + e);
    }

    return modelChanged;
  }

  this.getModel = function (estimated) {
    if (this.visible) {
      var daveModel = { type: this.type, color: this.color };
      var modelParams = this.getParammeters();

      for (p in modelParams){
        var paramName = modelParams[p];
        if (!estimated) {
          daveModel[paramName] = this[paramName];
        } else if (!isNull(this[paramName + "Est"])){
          daveModel[paramName] = this[paramName + "Est"].value;
        } else {
          return null;
        }

        if (this.isFixedParam(paramName)){
          //Adds fixed param to model
          if (isNull(daveModel["fixed"])){
            daveModel["fixed"] = [];
          }
          daveModel["fixed"].push(paramName);
        }
      }

      return daveModel;
    }

    return null;
  }

  this.setEstimation = function (params, modelIdx) {
    var modelParams = this.getParammeters();

    for (p in modelParams){
      var paramName = modelParams[p] + ((modelIdx != -1) ? "_" + modelIdx : "");

      for (i in params){
        var param = params[i];

        if (param.name == paramName) {
            if (!isNull(param.opt)) {
              //The estimation is an Stingray parameters optimization
              this[modelParams[p] + "Est"] = { value: param.opt, err: param.err };
            } else {
              //The estimation is from Bootstrap method
              this[modelParams[p] + "Err"] = param.err;
            }
            break;
        }
      }
    }
    this.setInputs();
  }

  this.applyEstimations = function (paramName) {
    if (this.visible) {
      var daveModel = { type: this.type, color: this.color };
      var modelParams = this.getParammeters();
      for (p in modelParams){
        this.applyEstimation(modelParams[p]);
      }
      this.setInputs();
    }
  }

  this.applyEstimation = function (paramName) {
    if (!isNull(this[paramName + "Est"])){
      this[paramName] = this[paramName + "Est"].value;
      //this[paramName + "Est"] = null;
    }
  }

  this.clearEstimationsAndErrors = function () {
    var modelParams = this.getParammeters();
    for (p in modelParams){
      this[modelParams[p] + "Est"] = null;
      this[modelParams[p] + "Err"] = null;
    }
    this.setInputs();
  }

  this.isFixedParam = function (paramName) {
    return !isNull(this[paramName + "Fixed"]) && this[paramName + "Fixed"];
  }

  this.switchFixedParam = function (paramName) {
    if (this.isFixedParam(paramName)){
      this[paramName + "Fixed"] = false;
    } else {
      this[paramName + "Fixed"] = true;
    }
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

  this.getParammeters = function () {
    return ["amplitude", "mean", "stddev"];
  }

  Model.call(this,
            idx,
            '- Gaussian ' + idx + ':',
            'Gaussian',
            color, onModelsChangedFn);

  //Prepares inputs
  this.setInputs();

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

  this.getParammeters = function () {
    return ["amplitude", "x_0", "fwhm"];
  }

  Model.call(this,
            idx,
            '- Lorentz ' + idx + ':',
            'Lorentz',
            color, onModelsChangedFn);

  //Prepares inputs
  this.setInputs();

  log ("new LorentzModel id: " + this.id);

  return this;
}


//Model: PowerLaw specific model inherited from Model class
function PowerLawModel(idx, color, onModelsChangedFn) {

  var currentObj = this;
  this.id = "powerLaw_" + idx;

  this.amplitude = 5.0;
  this.x_0 = 1.0;
  this.alpha = 0.5;

  this.getParammeters = function () {
    return ["amplitude", "x_0", "alpha"];
  }

  Model.call(this,
            idx,
            '- PowerLaw ' + idx + ':',
            'PowerLaw',
            color, onModelsChangedFn);

  //Prepares inputs
  this.setInputs();

  log ("new PowerLawModel id: " + this.id);

  return this;
}


//Model: BrokenPowerLaw specific model inherited from Model class
function BrokenPowerLawModel(idx, color, onModelsChangedFn) {

  var currentObj = this;
  this.id = "brokenPowerLaw_" + idx;

  this.amplitude = 5.0;
  this.x_break = 1.0;
  this.alpha_1 = 0.5;
  this.alpha_2 = 0.5;

  this.getParammeters = function () {
    return ["amplitude", "x_break", "alpha_1", "alpha_2"];
  }

  Model.call(this,
            idx,
            '- BrokenPowerLaw ' + idx + ':',
            'BrokenPowerLaw',
            color, onModelsChangedFn);

  //Prepares inputs
  this.setInputs();

  log ("new BrokenPowerLawModel id: " + this.id);

  return this;
}
