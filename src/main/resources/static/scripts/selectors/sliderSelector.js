
function sliderSelector(id, title, filterData, fromValue, toValue, onSelectorValuesChangedFn, selectors_array, onSlideChanged, precision, fixed_step) {

  var thePrecision = !isNull(precision) ? precision : CONFIG.DEFAULT_NUMBER_DECIMALS;
  if (!isNull(fixed_step)) {
    var fsPrecision = getPrecisionFromFloat(fixed_step);
    if (fsPrecision > thePrecision) { thePrecision = fsPrecision };
  }

  var currentObj = this;
  this.id = id.replace(/\./g,'');
  this.title = title;
  this.filterData = filterData;
  this.initFromValue = fromValue;
  this.initToValue = toValue;
  this.fromValue = fromValue;
  this.toValue = toValue;
  this.maxRange = this.initToValue - this.initFromValue;
  this.precision = thePrecision;
  this.fixed_step = !isNull(fixed_step) ? fixed_step : null; // Sets the value step for snaping, fixed_step = 0.5 -> values: ... -1.0, -0.5, 0.0, 0.5, 1.0 ...
  this.step = !isNull(fixed_step) ? fixed_step : ((precision > 0) ? (this.maxRange / Math.pow(10, precision)) : 1.0);
  this.onSelectorValuesChanged = onSelectorValuesChangedFn;
  this.enabled = false;
  this.disableable = isNull(this.filterData.source);
  this.multiplier = 1.0;

  if (!isNull(selectors_array)){
    selectors_array = sliderSelectors_addSelector(selectors_array, this);
  }

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' + title +
                  '<div class="switch-wrapper">' +
                  '  <div id="switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                  '</div>' +
                  '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromValue + '" value="' + fromValue + '" />' +
                  ' <input id="to_' + this.id + '" class="selectorTo" type="text" name="to_' + this.id + '" placeholder="' + toValue + '" value="' + toValue + '" />' +
                  ' <div id="slider-' + this.id + '" class="selectorSlider"></div>' +
                  '</div>' +
                '</div>');

  //Caches the controls for further use
  this.container = this.$html.find(".selectorContainer");
  this.switchBox = this.$html.find("#switch_" + this.id);
  this.fromInput = this.$html.find("#from_" + this.id);
  this.toInput = this.$html.find("#to_" + this.id);
  this.slider = this.$html.find("#slider-" + this.id);

  this.inputChanged = function ( event ) {
    currentObj.setValues( getInputFloatValue(currentObj.fromInput, currentObj.fromValue), getInputFloatValue(currentObj.toInput, currentObj.toValue) );
    currentObj.onSelectorValuesChanged(currentObj);
  };
  this.fromInput.on('change', this.inputChanged);
  this.toInput.on('change', this.inputChanged);

  //Prepares switchBox
  this.switchBox.click( function ( event ) {
    var switchId = event.target.id.replace("switch_", "");
    var sliderSelectors_array = getTabForSelector(switchId).toolPanel.selectors_array;
    var slider = sliderSelectors_array[switchId];
    slider.setEnabled (!slider.enabled);
    slider.onSelectorValuesChanged(slider);
  });

  if (!this.disableable) {
    this.switchBox.hide();
  }

  this.onSlideChanged = !isNull(onSlideChanged) ? onSlideChanged : function( event, ui ) {
    var sliderId = event.target.id.replace("slider-", "");
    var tab = getTabForSelector(sliderId);
    if (!isNull(tab)){
      var sliderSelectors_array = tab.toolPanel.selectors_array;
      var sliderWdg = sliderSelectors_array[sliderId];
      sliderWdg.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
      sliderWdg.onSelectorValuesChanged(sliderWdg);
    }
  };

   this.createSlider = function () {
     this.slider.slider({
            range:true,
            min: this.fromValue,
            max: this.toValue,
            step: this.step,
            values: [ fromValue, toValue ],
            slide: this.onSlideChanged
        });
      this.setValues( this.fromValue, this.toValue );
   }

   this.setDisableable = function (disableable) {
     setVisibility(this.switchBox.parent(), disableable);
     if (!disableable){
       this.setEnabled(true);
     }
   }

   //Set values method
   this.setValues = function (from, to, source) {

       from = Math.min(Math.max(parseFloat(from), this.initFromValue), this.initToValue)
       to = Math.min(Math.max(parseFloat(to), this.initFromValue), this.initToValue)
       if (to < from) {
          var swap = from;
          from = to;
          to = swap;
       } else if (from == to) {
         if (to + this.step > this.initToValue){
           from -= this.step;
         } else {
           to += this.step;
         }
       }

       var moveSlider = source != "slider";
       // Fits values to max range
       if ((to - from) > this.maxRange){
          if (this.toValue != fixedPrecision(to, this.precision)) {
            //ToValue was changed
            from = to - this.maxRange;
          } else {
            to = from + this.maxRange;
          }
          moveSlider = true;
       }

       this.fromValue = from;
       this.toValue = to;

       this.snapValuesToStep();
       this.snapValuesToPrecision();

       this.fromInput.val( this.fromValue ).removeClass("wrongValue");
       this.toInput.val( this.toValue ).removeClass("wrongValue");
       if (moveSlider) {
         this.slider.slider('values', 0, this.fromValue);
         this.slider.slider('values', 1, this.toValue);
       }
       this.slider.slider("option", "step", this.step);
   }

   this.setFixedStep = function (fixed_step, updateValues) {
     this.step = fixed_step;
     this.fixed_step = fixed_step;
     if (isNull(updateValues) || updateValues){
       this.setValues( this.fromValue, this.toValue );
     }
   }

   this.snapValuesToStep = function () {
     if ( !isNull(this.fixed_step) ) {
       this.fromValue = Math.floor (this.fromValue / this.fixed_step) * this.fixed_step;
       this.toValue = Math.ceil (this.toValue / this.fixed_step) * this.fixed_step;
     }
   }

   this.snapValuesToPrecision = function () {
     this.fromValue = fixedPrecision(this.fromValue, this.precision);
     this.toValue = fixedPrecision(this.toValue, this.precision);
   }

   this.getFilter = function () {
     if (this.enabled) {
        this.filterData.from = this.fromValue * this.multiplier;
        this.filterData.to = this.toValue * this.multiplier;
        return this.filterData;
     } else {
        return null;
     }
   }

   this.setFilter = function (filter) {
     if (this.filterData.table == filter.table
          && this.filterData.column == filter.column
          && ( isNull(this.filterData.replaceColumn)
              || (this.filterData.replaceColumn == filter.replaceColumn))) {
        this.setValues( filter.from, filter.to );
        this.setEnabled (true);
        return true;
     }
     return false;
   }

   this.applyFilter = function (filter) {
     if (this.filterData.table == filter.table
          && this.filterData.column == filter.column
          && (this.fromValue < filter.from
          || this.toValue > filter.to )) {

        this.setValues( filter.from, filter.to );
        this.setEnabled (true);
        this.onSelectorValuesChanged(this);
     }
   }

   this.setEnabled = function (enabled) {
     this.enabled = enabled;
     if (enabled) {
       this.switchBox.switchClass("fa-plus-square", "fa-minus-square");
       this.container.fadeIn();
     } else {
       this.switchBox.switchClass("fa-minus-square", "fa-plus-square");
       if (this.disableable){
         this.setValues( this.initFromValue, this.initToValue );
       }
       this.container.fadeOut();
     }
   }

   this.setMaxRange = function (maxRange) {
     if (maxRange < this.maxRange) {
       this.maxRange = maxRange;
       var toValueInc = (this.initToValue - this.initFromValue) * (maxRange/(this.initToValue - this.initFromValue));
       this.setValues( this.initFromValue, this.initFromValue + toValueInc );
       this.switchBox.hide();
     }
   }

   this.setMinMaxValues = function (minValue, maxValue) {
     this.fromValue = minValue;
     this.initFromValue = this.fromValue;
     this.toValue = maxValue;
     this.initToValue = this.toValue;
     this.maxRange = this.initToValue - this.initFromValue;
     this.$html.find("#slider-" + this.id).remove();
     this.slider = $('<div id="slider-' + this.id + '" class="selectorSlider"></div>');
     this.container.append(this.slider);
     this.createSlider();
   }

   //Init from-to values
   this.createSlider();

   //Collapses container
   this.container.hide();

   log ("new sliderSelector id: " + this.id + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue);

   return this;
}


//STATIC SLIDER_SELECTOR METHODS

function sliderSelectors_getFilters (selectors_array) {
  var filters = [];
  for (i in selectors_array) {
    var filter = selectors_array[i].getFilter();
    if (filter != null) {
      filters.push(filter);
    }
  }
  return filters;
}

function sliderSelectors_applyFilters (filters, selectors_array) {
  for (f in filters) {
    for (i in selectors_array) {
      selectors_array[i].applyFilter(filters[f]);
    }
  }
}

function sliderSelectors_setFilters (filters, selectors_array) {
  for (i in selectors_array) {
    var filterSetted = false;
    for (f in filters) {
      filterSetted = selectors_array[i].setFilter(filters[f]);
      if (filterSetted) {break;}
    }
    if (!filterSetted && isNull(selectors_array[i].filterData.replaceColumn)) {
      selectors_array[i].setEnabled(false);
    }
  }
}

function sliderSelectors_setFiltersEnabled (selectors_array, source, columnName) {
  for (i in selectors_array) {
    var selector = selectors_array[i];
    if (selector.filterData.source == source){
        selector.setEnabled(selector.filterData.replaceColumn == columnName);
      }
  }
}

function sliderSelectors_getSelector (selectors_array, selectorId) {
  for (i in selectors_array) {
    var selector = selectors_array[i];
    if (selector.id == selectorId ){
        return selector;
    }
  }
  return null;
}

function sliderSelectors_getSelectors (selectors_array, source, columnName) {
  var selectors = [];
  for (i in selectors_array) {
    var selector = selectors_array[i];
    if (selector.filterData.source == source
        && selector.filterData.replaceColumn == columnName){
        selectors.push(selector);
      }
  }
  return selectors;
}

function sliderSelectors_addSelector (selectors_array, selector) {
  selectors_array[selector.id] = selector;
  return selectors_array;
}

function sliderSelectors_removeSelector (selectors_array, selector) {
  var selectors = [];
  for (i in selectors_array) {
    var tmpSelector = selectors_array[i];
    if (tmpSelector.id != selector.id){
      selectors = sliderSelectors_addSelector(selectors, tmpSelector);
    }
  }
  return selectors;
}
