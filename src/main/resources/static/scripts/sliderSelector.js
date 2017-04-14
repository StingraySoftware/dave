
function sliderSelector(id, title, filterData, fromLabel, toLabel, fromValue, toValue, onSelectorValuesChangedFn, selectors_array) {

  var currentObj = this;
  this.id = id.replace(/\./g,'');
  this.title = title;
  this.filterData = filterData;
  this.fromLabel = fromLabel;
  this.toLabel = toLabel;
  this.initFromValue = fromValue;
  this.initToValue = toValue;
  this.fromValue = fromValue;
  this.toValue = toValue;
  this.maxRange = this.initToValue - this.initFromValue;
  this.onSelectorValuesChanged = onSelectorValuesChangedFn;
  this.enabled = false;
  this.disableable = isNull(this.filterData.source);

  selectors_array[this.id] = this;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' + title +
                  '<div class="switch-wrapper">' +
                  '  <div id="switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                  '</div>' +
                  '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '" value="' + fromValue + '" />' +
                  ' <input id="to_' + this.id + '" class="selectorTo" type="text" name="to_' + this.id + '" placeholder="' + toLabel + '" value="' + toValue + '" />' +
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
    currentObj.setValues( currentObj.fromInput.val(), currentObj.toInput.val() );
    currentObj.onSelectorValuesChanged();
  };
  this.fromInput.on('input', this.inputChanged);
  this.toInput.on('input', this.inputChanged);

  //Prepares switchBox
  this.switchBox.click( function ( event ) {
    var switchId = event.target.id.replace("switch_", "");
    var sliderSelectors_array = getTabForSelector(switchId).toolPanel.selectors_array;
    sliderSelectors_array[switchId].setEnabled (!sliderSelectors_array[switchId].enabled);
    sliderSelectors_array[switchId].onSelectorValuesChanged();
  });

  if (!this.disableable) {
    this.switchBox.hide();
  }

  //Creates the slider
  this.slider.slider({
         range:true,
         min: this.fromValue,
         max: this.toValue,
         values: [ fromValue, toValue ],
         slide: function( event, ui ) {
           var sliderId = event.target.id.replace("slider-", "");
           var sliderSelectors_array = getTabForSelector(sliderId).toolPanel.selectors_array;
           var sliderWdg = sliderSelectors_array[sliderId];
           sliderWdg.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
           sliderWdg.onSelectorValuesChanged();
         }
     });

   //Set values method
   this.setValues = function (from, to, source) {

       from = Math.min(Math.max(parseFloat(from), this.initFromValue), this.initToValue)
       to = Math.min(Math.max(parseFloat(to), this.initFromValue), this.initToValue)
       if (to < from) {
          var swap = from;
          from = to;
          to = swap;
       }

       var moveSlider = source != "slider";
       // Fits values to max range
       if ((to - from) > this.maxRange){
          if (this.toValue != Math.ceil(to)) {
            //ToValue was changed
            from = to - this.maxRange;
          } else {
            to = from + this.maxRange;
          }
          moveSlider = true;
       }

       var step = 1.0;
       if (this.filterData.column == "TIME") {
          //Fixes values to binSize steps
           var binSize = getTabForSelector(this.id).projectConfig.binSize;
           step = parseFloat(binSize);
           this.fromValue = Math.floor (from / binSize) * binSize;
           this.toValue = Math.floor (to / binSize) * binSize;
       }

       this.fromValue = Math.floor(from);
       this.toValue = Math.ceil(to);
       this.fromInput.val( this.fromValue );
       this.toInput.val( this.toValue );
       if (moveSlider) {
         this.slider.slider('values', 0, this.fromValue);
         this.slider.slider('values', 1, this.toValue);
       }
       this.slider.slider("option", "step", step);
   }

   this.getFilter = function () {
     if (this.enabled) {
        this.filterData.from = this.fromValue;
        this.filterData.to = this.toValue;
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
        this.onSelectorValuesChanged();
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
     }
   }

   //Init from-to values
   this.setValues( this.initFromValue, this.initToValue );

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
    if (!filterSetted) {
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
