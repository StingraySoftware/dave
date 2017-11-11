
function BinSelector(id, title, fromValue, toValue, step, initValue, onSelectorValuesChangedFn, onSlideChanged, precision, type) {

  var currentObj = this;
  this.id = id.replace(/\./g,'');
  this.title = title;
  this.initFromValue = fromValue;
  this.initToValue = toValue;
  this.fromValue = fromValue;
  this.toValue = toValue;
  this.value = initValue;
  this.initValue = initValue;
  this.step = step;
  this.type = (!isNull(type) && (type == "log")) ? type : "linear"; // Type: linear or log
  this.precision = !isNull(precision) ? precision : CONFIG.DEFAULT_NUMBER_DECIMALS;
  this.onSelectorValuesChanged = onSelectorValuesChangedFn;
  this.onSelectorEnabledChanged = null;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' +
                    title +
                    '<div class="switch-wrapper">' +
                    '  <div id="switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                    '</div>' +
                  '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromValue + '" value="' + fromValue + '" />' +
                  ' <div id="slider-' + this.id + '" class="selectorSlider"></div>' +
                  '</div>' +
                '</div>');

  //Caches the controls for further use
  this.container = this.$html.find(".selectorContainer");
  this.switchBox = this.$html.find("#switch_" + this.id);
  this.fromInput = this.$html.find("#from_" + this.id);
  this.slider = this.$html.find("#slider-" + this.id);

  this.switchBox.parent().hide();

  this.setTitle = function (title) {
    this.title = title;
    this.$html.find("h3").first().html(title);
  }

  this.setDisableable = function (disableable) {
    if (disableable){
      this.switchBox.parent().show();
    } else {
      this.switchBox.parent().hide();
    }
  }

  this.inputChanged = function ( event ) {
    currentObj.setValues( getInputFloatValue(currentObj.fromInput, currentObj.value) );
    currentObj.onSelectorValuesChanged();
  };
  this.fromInput.on('change', this.inputChanged);

   //Set values method
   this.setValues = function (value, source) {
     if ((this.type == "log") && (source == "slider")) {
       //If is log scale, and value comes from slider change, the gets the real value from slider ratio
       value = this.getValueFromRatio(value);
     }
     this.value = Math.min(Math.max(fixedPrecision(value, this.precision), this.initFromValue), this.initToValue);
     this.fromInput.val( fixedPrecision(this.value, this.precision) ).removeClass("wrongValue");
     if (source != "slider") {
       this.slider.slider('values', 0, (this.type != "log") ? this.value : this.getRatioFromValue(this.value));
     }

     var tab = getTabForSelector(this.id);
     if (!isNull(tab)) {
       tab.projectConfig.binSize = fixedPrecision(this.value, this.precision);
       if (tab.projectConfig.binSizeCouldHaveAliasing()) {
         this.showWarn("Aliasing/Moiré effects could arise");
       } else {
         this.showWarn("");
       }
     }
   }

   this.setEnabled = function (enabled) {
     this.enabled = enabled;
     if (enabled) {
       this.switchBox.switchClass("fa-plus-square", "fa-minus-square");
       this.container.fadeIn();
     } else {
       this.switchBox.switchClass("fa-minus-square", "fa-plus-square");
       this.setValues( this.value );
       this.container.fadeOut();
     }
   }

   this.setMinMaxValues = function (minValue, maxValue, step, showRange) {
     this.fromValue = minValue;
     this.initFromValue = this.fromValue;
     this.step = isNull(step) ? this.fromValue : step;
     this.toValue = maxValue;
     this.initToValue = this.toValue;
     this.$html.find("#slider-" + this.id).remove();
     this.slider = $('<div id="slider-' + this.id + '" class="selectorSlider"></div>');
     this.container.append(this.slider);
     this.createSlider();
     if (isNull(showRange) || showRange){
       this.$html.find("h3").first().html(this.title + "<span style='font-size:0.7em'>( " + fixedPrecision(this.fromValue, this.precision) + " - " + fixedPrecision(this.toValue, this.precision) + " )</span>");
     }
   }

   this.setStep = function (step) {
     this.step = step;
     this.slider.slider("option", "step", this.step);
   }

   this.onSlideChanged = !isNull(onSlideChanged) ? onSlideChanged : function( event, ui ) {
     var sliderId = event.target.id.replace("slider-", "");
     var tab = getTabForSelector(sliderId);
     if (tab != null){
       tab.toolPanel.binSelector.setValues( ui.values[ 0 ], "slider");
       tab.toolPanel.binSelector.onSelectorValuesChanged();
     }
   };

   this.createSlider = function () {
     this.slider.slider({
            min: (this.type != "log") ? this.fromValue : 0,
            max: (this.type != "log") ? this.toValue : CONFIG.BIN_SELECTOR_LOG_SCALE_STEPS,
            values: (this.type != "log") ? [this.value] : [this.getRatioFromValue(this.value)],
            step: (this.type != "log") ? this.step : 1,
            slide: this.onSlideChanged
        });
      this.setValues( this.value );
   }

   this.getRatioFromValue = function (value) {
     return Math.pow(((value - this.fromValue) / (this.toValue - this.fromValue)), 1 / CONFIG.BIN_SELECTOR_LOG_SCALE_POWER) * CONFIG.BIN_SELECTOR_LOG_SCALE_STEPS;
   }

   this.getValueFromRatio = function (ratioValue) {
     return ((this.toValue - this.fromValue) * (Math.pow(ratioValue / CONFIG.BIN_SELECTOR_LOG_SCALE_STEPS, CONFIG.BIN_SELECTOR_LOG_SCALE_POWER))) + this.fromValue;
   }

   this.showWarn = function (msg) {
     this.$html.find(".btnWarn").remove();
     if (!isNull(msg) && msg != ""){
       this.$html.append($('<a href="#" class="btn btn-danger btnWarn"><div>' +
                                       '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + msg +
                                     '</div></a>'));
     }
   }

   //Init from-to values
   this.createSlider();

   log ("new binSelector id: " + this.id + ", Value: " + this.value + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue + ", step: " + this.step);

   return this;
}

//Caluculates intial, max, min and step values for bin size slider
function getBinSelectorConfig (projectConfig) {

  var minBinSize = 1;
  var initValue = 1;
  var step = 1;
  var multiplier = 1;

  //If binSize is smaller than 1.0 find the divisor
  while (projectConfig.maxBinSize * multiplier < 1) {
    multiplier *= 10;
  }

  var tmpStep = (1.0 / multiplier) / 100.0;
  if ((projectConfig.maxBinSize / tmpStep) > CONFIG.MAX_PLOT_POINTS) {
    //Fix step for not allowing more plot point than CONFIG.MAX_PLOT_POINTS
    tmpStep = projectConfig.maxBinSize / CONFIG.MAX_PLOT_POINTS;
  }
  minBinSize = tmpStep;
  step = minBinSize / 100.0; // We need at least 100 steps on slider

  if (projectConfig.minBinSize > 0) {
    minBinSize = projectConfig.minBinSize;
    var minAvailableBinSize = fixedPrecision(projectConfig.totalDuration / CONFIG.MAX_PLOT_POINTS, CONFIG.MAX_TIME_RESOLUTION_DECIMALS);
    if (CONFIG.AUTO_BINSIZE && (minAvailableBinSize > minBinSize)){
      initValue = minAvailableBinSize;
    } else {
      initValue = minBinSize;
    }
    step = minBinSize;
  } else {
    initValue = (projectConfig.maxBinSize - minBinSize) / 50; // Start initValue triying to plot at least 50 points
  }

  return {
            binSize: initValue,
            minBinSize: minBinSize,
            maxBinSize: projectConfig.maxBinSize,
            step: step
          };
}
