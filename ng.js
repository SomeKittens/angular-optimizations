// Allows us to tell how many cycles have been run since we last reset
var scopeWatcher = (function () {
  var cyclesRun = 0;
  var digestLengths = [];
  return {
    instrument: function ($delegate) {
      // Modified from:
      // https://github.com/angular/angular-hint/blob/master/src/modules/scopes.js#L134
      var scopePrototype = ('getPrototypeOf' in Object) ?
        Object.getPrototypeOf($delegate) : $delegate.__proto__;
      var _digest = scopePrototype.$digest;
      scopePrototype.$digest = function (fn) {
        cyclesRun++;
        var start = performance.now();
        var ret = _digest.apply(this, arguments);
        digestLengths.unshift(performance.now() - start);
        return ret;
      };
      return $delegate;
    },
    reset: function () {
      cyclesRun = 0;
    },
    // Siiiiiigh
    get: function () {
      return cyclesRun;
    },
    lastDigest: function () {
      return digestLengths[0];
    }
  };
})();

angular.module('OptimizationsVisualized', ['ui.router'])
.config(function ($provide) {
  $provide.decorator('$rootScope', ['$delegate', scopeWatcher.instrument]);
})
.config(function ($stateProvider, $urlRouterProvider) {
  // Beginning and end:
  $stateProvider
  .state('part0', {
    url: '/0',
    templateUrl: 'templates/home.html'
  })
  .state('part6', {
    url: '/6',
    templateUrl: 'templates/end.html'
  });
  for (var i = 1; i <= 5; i++) {
    $stateProvider
    .state('part' + i, {
      url: '/' + i,
      controller: 'Part' + i + 'Controller',
      controllerAs: 'P' + i,
      templateUrl: 'templates/part' + i + '.html',
      num: i
    });
  }
  $urlRouterProvider.otherwise('/0');
})
.controller('Part1Controller',
  function ($scope, $timeout, $window, generateDatums, checkWatchers) {
  // Bind Once
  var P1 = this;
  // TODO: Show length of digest cycle
  P1.people = generateDatums(1000);

  // Trigger digest after page load
  $timeout(function () {
    P1.showWatchers = false;
  });

  $scope.$watch('P1.boundOnce', function () {
    // We need to run checkWatchers *after*
    // the current digest cycle to get the latest data
    $timeout(function () {
      P1.showWatchers = checkWatchers('body');
      // Broken for now
      // P1.digestLength = $window.scopeWatcher.lastDigest();
    });
  });
})
.controller('Part2Controller', function ($window, $scope, $timeout) {
  // Let Angular run the digest cycle
  var P2 = this;

  P2.properCycles = 1;
  $window.scopeWatcher.reset();

  $scope.$watch(function () {
    return $window.scopeWatcher.get();
  }, function () {
    P2.cyclesRun = $window.scopeWatcher.get();
  });

  P2.gimmeRandom = function () {
    P2.properCycles++;
    $timeout(function () {
      P2.random = Math.random();
    });
  };

  P2.getBadCycles = function () {
    return Math.max(P2.cyclesRun - P2.properCycles, 0);
  };
})
.controller('Part3Controller', function (generateDatums) {
  // track by
  var P3 = this;

  var allPeople = generateDatums(500);
  var somePeople = allPeople.filter(function (person, idx) {
    return idx % 2;
  })
  .map(function (person) {
    // not strictly needed but proves we've got a different object reference
    return angular.copy(person);
  });

  P3.people = allPeople;
  P3.trackedPeople = allPeople;

  P3.flip = function (isTracking) {
    if (isTracking) {
      if (P3.trackedPeople === allPeople) {
        P3.trackedPeople = somePeople;
      } else {
        P3.trackedPeople = allPeople;
      }
    } else {
      if (P3.people === allPeople) {
        P3.people = somePeople;
      } else {
        P3.people = allPeople;
      }
    }
  };
})
.controller('Part4Controller',
  function ($scope, $timeout, generateDatums, checkWatchers) {
  // ng-hide vs ng-if
  var P4 = this;
  P4.people = generateDatums(500);


  $timeout(function () {
    // Set these here to trigger digest *after* ng-includes load
    P4.show = true;
    P4.if = true;
  });

  $scope.$watch('P4.show', function () {
    // We need to run checkWatchers *after*
    // the current digest cycle to get the latest data
    $timeout(function () {
      var ret = checkWatchers('.ao-show');
      P4.showWatchers = ret;
    });
  });
  $scope.$watch('P4.if', function () {
    $timeout(function () {
      var ret = checkWatchers('.ao-if');
      P4.ifWatchers = ret;
    });
  });
})
.controller('Part5Controller', function ($scope, $window) {
  // Avoiding ng-events
  var P5 = this;

  $window.scopeWatcher.reset();

  $scope.$watch(function () {
    return $window.scopeWatcher.get();
  }, function () {
    P5.cyclesRun = $window.scopeWatcher.get();
  });

  P5.digest = angular.noop;
})
.factory('generateDatums', function () {
  var id;
  function createDatum () {
    return {
      name: faker.name.findName(),
      email: faker.internet.email(),
      activity: faker.hacker.ingverb() + ' ' + faker.hacker.noun(),
      id: id++
    };
  }

  return function (numDatums) {
    // reset for each call
    id = 0;
    var datums = [];
    for (var i = 0; i < numDatums; i++) {
      datums.push(createDatum());
    }
    return datums;
  };
})
.factory('checkWatchers', function () {
  return function (query) {
    var scope;
    var watchers = 0;
    var aoEl = document.querySelector(query);
    if (!aoEl) { return; }
    var elementsWithScope = aoEl.querySelectorAll('.ng-scope');
    for (var i = 0; i < elementsWithScope.length; i++) {
      scope = angular.element(elementsWithScope[i]).scope();
      if (scope.$$watchers !== null) {
        watchers += scope.$$watchers.length;
      }
    }
    return watchers;
  };
})
.directive('optsNav', function ($state) {
  return {
    templateUrl: 'templates/nav.html',
    scope: true,
    link: function ($scope) {
      $scope.back = function () {
        $state.go('part' + ($state.current.num - 1));
      };
      $scope.next = function () {
        $state.go('part' + ($state.current.num + 1));
      };
    }
  };
});