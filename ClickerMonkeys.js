// ==UserScript==
// @id          ClickerMonkeys
// @name        Clicker Monkeys
// @namespace   .
// @version     1.4.2801
// @authors     Zininzinin, unv_annihilator
// @description Trying to automate ALL THE THINGS with clicker heroes
// @include     http://www.clickerheroes.com/
// @grant       none
// @require     http://code.jquery.com/jquery-2.1.1.min.js
// ==/UserScript==

(function() {
    "use strict";
    
    var main = function() {
        "use strict";
        
        //Intervals
        var purchaseInterval = 250; //Basically how fast it levels up heroes. Set interval higher for slower repeats.
        var ascendInterval = 30000; //How often to check if you should ascend in miliseconds. Default is 30 seconds.
        var skillInterval = 1000; //How often to poll for skills
        var bossTimeoutInterval = 10000; //How often to check for retry boss timeout
        
        //Defaults (what to run on start)
        var autoBuy = true; //autobuy heroes by default
        var autoAscend = true; //auto-ascend by default
        var levelCidEnabled = true; //Auto-level Cid by default
        var disableLogo = true; //Remove Clicker Heroes logo from top of page. Used for lower resolution screens
        var darkRitualEnabled = true; //If dark ritual is enabled on start
        var useOtherSkills = true; //Allows script to use skills defined by variable skillsToSpam
        
        //Timeouts
        var ascendTimeout = 60;//If a zone takes longer than this timeout (seconds), it will ascend
        var bossTimeout = 60000 * 5; //After failing to kill a boss, how long to wait to retry (default is 20 minutes) 60000 * 20
        var purchaseTimeout = 20000; //If a hero is not purchased in this time frame, the highest possible hero will be purchased.
        
        //Other variables
        var otherSkills = [1, 2, 3, 4, 5, 7]; //List of skills to use. 1 = clickstorm recommended for autoclickers = [1, 2, 3, 4, 5, 7];
        var minAscendZone = 150; //Will not ascend before you have reached this zone
        var enableDebug = true; //Enables debug messaging. Messages can be viewed in browser console.
        var maxLevelAscend = 180; //If zone is passed, will ascend
        
        //WARNING: Do Not Change
        var JSMod = null;
        var loadAttempts = 0;
        var maxAttempts = 100;
        var loadTimeout = 10000;
        
        //WARNING: Do Not Change
        var baseCosts = [10, 50, 250, 1000, 4000, 20000, 100000, 400000, 2500000, 15000000, 100000000, 800000000, 6500000000, 50000000000, 450000000000, 4000000000000, 36000000000000, 320000000000000, 2700000000000000, 24000000000000000, 300000000000000000, 9000000000000000000, 350000000000000000000, 1.4e+22, 4.19999999999999e+24, 2.1e+27];
        var maxLevels = [150, 100, 125, 75, 100, 100, 75, 75, 75, 100, 75, 100, 100, 100, 100, 125, 125, 75, 75, 150, 100, 100, 125, 100, 75, 75];
        var baseDamage = [0, 5, 22, 74, 245, 976, 3725, 10859, 47143, 186000, 782000, 3721000, 17010000, 69480000, 460e6, 3017e6, 20009e6, 131e9, 814e9, 5335e9, 49143e9, 1086e12, 31124e12, 917e15, 202e18, 74698e18];
        var zoneTimer = 0;
        var bossTimer = 0;
        var currentZone = 0;
        var previousZone = 0;
        var dogcog = 1;
        var nextHero;
        var lastHeroPurchasedTimer = Date.now();
        
        //GUI: Do Not Change
        var autoBuyButton = document.createElement('input');
        var levelCidButton = document.createElement('input');
        var darkRitualButton = document.createElement('input');
        var autoAscendButton = document.createElement('input');
        var otherSkillsButton = document.createElement('input');
        
        var App = {
            name: "Clicker Monkeys",
            onPlaying: function() {
                setInterval(getMostEfficientHero, purchaseInterval);
                setInterval(tryAscend, ascendInterval);
                setInterval(useSkills,skillInterval);
                setInterval(autoProgress,bossTimeoutInterval);
                
                try {
                    JSMod.setProgressMode(true);
                } catch (e) { 
                    debug("Something went wrong setting progress: " + e.message);
                }
            },
            onSelectedZone: function(zone) {
                zoneTimer = Date.now();
                previousZone = currentZone;
                currentZone = zone;
                //debug("New zone: " + zone + " at time " + zoneTimer);
                autoProgress();
                if (zone > maxLevelAscend)
                    tryAscend();
            },
            onReady: function() {
                debug("Ready to roll fox!");
                initButtons();
                baseCosts[0] = ((!levelCidEnabled) ? Number.MAX_VALUE : 10);
            }
        };
        
        function debug(message) {
            if (enableDebug)
                console.log(message);
        }
        
        function useSkills() {
            if (darkRitualEnabled)
                darkRitual();
            if (useOtherSkills) {
                for (var i = 0; i < otherSkills.length; i++) {
                    //debug('Trying to spam skill ' + skillsToSpam[i]);
                    if (skillsReady([otherSkills[i]]))
                        JSMod.useSkill(otherSkills[i]);
                }
            }
        }
        
        function getAncientLevel(id) {
            try {
                return getUserData().ancients.ancients[id].level;
            } catch (e) {
                return 0;
            }
        }
        
        function skillsUnlocked(skillIDs) {
            var save = getUserData();
            for (var i = 1; i <= skillIDs.length; i++) {
                if (save.skillCooldowns[skillIDs[i]] === undefined)
                    return false;
            }
            return true;
        }
        
        function getSkillCooldown(skillID) {
            var vaagurMultiplier = 1;
            try {
                vaagurMultiplier = (100 - getAncientLevel(20) * 5) / 100;
            } catch (e) { /* Ignore exception. */ }
            return [10, 10, 30, 30, 60, 480, 60, 60, 60][skillID - 1] * 1000 * 60 * vaagurMultiplier;
        }
        
        function skillsReady(skillIDs) {
            var cooldowns = getUserData().skillCooldowns;
            for (var i = 0; i < skillIDs.length; i++) {
                //debug('Skill ' + skillIDs[i] + ' CurrentCooldown ' + (Date.now() - cooldowns[skillIDs[i]]) + ' cooldownNeeded ' + getSkillCooldown(skillIDs[i]) + ' actual cooldown ' + cooldowns[skillIDs[i]]);
                if (cooldowns[skillIDs[i]] === undefined || (Date.now() - cooldowns[skillIDs[i]] < getSkillCooldown(skillIDs[i]) && cooldowns[skillIDs[i]] !== 0))
                    return false;
            }
            return true;
        }
        
        function darkRitual() {
            if (skillsReady([6, 8, 9])) {
                //debug("First EDR");
                JSMod.useSkill(8);
                JSMod.useSkill(6);
                JSMod.useSkill(9);
            } else if (skillsReady([8, 9])) {
                //debug("Second EDR");
                JSMod.useSkill(8);
                JSMod.useSkill(9);
            }
        }
        
        function autoProgress() {
            if (previousZone > currentZone) {
                if (bossTimer === 0) {
                    debug('Failed to kill boss. Starting timer');
                    bossTimer = Date.now();
                } else {
                    if ((Date.now() - bossTimer) > bossTimeout) {
                        debug("Trying to kill boss again");
                        JSMod.setProgressMode(true);
                        bossTimer = 0;
                        previousZone = currentZone;
                    }
                }
            }
        }
        
        //Commented because it sucks (need DPS in order for this version to work) << official 
        // function autoProgress() {
        //     var save = getUserData();
        //     var zone = save.currentZoneHeight;
        //     var bossHP;
        //     //If you are the zone before a boss
        //     if ((zone % 5) == 4) {
        //         var bossZone = zone + 1;
        //         if (zone < 140)
        //             bossHP = 10 * (Math.pow(1.6, (bossZone - 1)) + (bossZone - 1)) * 10;
        //         else
        //             bossHP = 10 * ((Math.pow(1.6, 139) + 139) * Math.pow(1.15, (bossZone - 140))) * 10;
        //         debug("Level " + bossZone + " Boss with HP " + bossHP);
        //     }
        //      //This will be needed at some point: var bossTimer = 30 + (getAncientLevel(17) * 5);
        // }
        
        function initButtons() {
            if (disableLogo) {
                document.getElementById("logo").style.display = 'none';
                document.getElementById("settingsIcon").style.display = 'none';
            }
            autoBuyButton.type = 'button';
            autoBuyButton.value = 'Auto-Buy ' + autoBuy;
            autoBuyButton.onclick = setAutoBuy;
            $('#header').append(autoBuyButton);
            setButtonCSS(autoBuyButton);
            
            levelCidButton.type = 'button';
            levelCidButton.value = 'Level Cid ' + levelCidEnabled;
            levelCidButton.onclick = setLevelCid;
            //levelCidButton.css('.button {background: #65a9d7;}');
            $('#header').append(levelCidButton);
            setButtonCSS(levelCidButton);
            
            darkRitualButton.type = 'button';
            darkRitualButton.value = 'Dark Ritual ' + darkRitualEnabled;
            darkRitualButton.onclick = setDarkRitual;
            $('#header').append(darkRitualButton);
            setButtonCSS(darkRitualButton);
            
            autoAscendButton.type = 'button';
            autoAscendButton.value = ((autoAscend) ? 'Auto Ascenion' : 'Deep Run');
            autoAscendButton.onclick = setAutoAscend;
            $('#header').append(autoAscendButton);
            setButtonCSS(autoAscendButton);
            
            otherSkillsButton.type = 'button';
            otherSkillsButton.value = ('Use Skills ' + useOtherSkills);
            otherSkillsButton.onclick = setOtherSkills;
            $('#header').append(otherSkillsButton);
            setButtonCSS(otherSkillsButton);
        }
        
        function setButtonCSS(button) {
            button.style.border = '1px solid #000000';
            button.style.alignItems = 'center';
            button.style.horizontalAlign = 'middle';
            button.style.padding = '6.5px 13px';
            button.style.webkitBorderRadius = '40px';
            button.style.mozBorderRadius = '40px';
            button.style.borderRadius = '40px';
            button.style.fontSize = '12px';
            button.style.fontFamily = 'Helvetica, Arial, Sans-Serif';
            button.style.textDecoration = 'none';
            button.style.verticalAlign = 'middle';
        }
        
        function setOtherSkills() {
            useOtherSkills = !useOtherSkills;
            otherSkillsButton.value = ('Use Skills ' + useOtherSkills);
        }
        
        function setAutoAscend() {
            debug('setAutoAscend Clicked!');
            autoAscend = !autoAscend;
            autoAscendButton.value = (autoAscend ? 'Auto Ascenion' : 'Deep Run');
        }
        
        function setDarkRitual() {
            debug('setDarkRitual Clicked!');
            darkRitualEnabled = !darkRitualEnabled;
            darkRitualButton.value = 'Dark Ritual ' + darkRitualEnabled;
        }
        
        function setAutoBuy() {
            debug('autoBuyButton Clicked!');
            autoBuy = !autoBuy;
            autoBuyButton.value = 'Auto-Buy ' + autoBuy;
        }
        
        function setLevelCid() {
            debug('setLevelCid Clicked!');
            levelCidEnabled = !levelCidEnabled;
            levelCidButton.value = 'Level Cid ' + levelCidEnabled;
            baseCosts[0] = ((!levelCidEnabled) ? Number.MAX_VALUE : 10);
        }
        
        function getUserData() {
            var gotData = true;
            var save;
            while (gotData){
                try {
                    save = JSON.parse(JSMod.getUserData());
                    gotData = false;
                } catch (e) {
                    debug('Failed to get userData' + e.message);
                    gotData = true;
                }
            }
            return save;
        }
        
        function upgradeAll() {
            try {
                JSMod.buyAllAvailableUpgrades();
            } catch (e) { /* Ignore error, button probably not unlocked yet. */ }
        }
        
        function reportSkillCooldowns() {
            for (var i = 1; i <= 9; i++)
                debug('Skill cooldown for skill ' + i + ' is ' + getUserData().skillCooldowns[i] + ' miliseconds');
        }
        
        function tryAscend() {
            if (autoAscend) {
                var timeout = (Date.now() - zoneTimer) / 1000;
                //debug("Trying to ascend. Timeout is " + timeout);
                if (currentZone >= minAscendZone && (timeout > ascendTimeout || currentZone > maxLevelAscend)) {
                    buyAllHeroes();
                    JSMod.ascend();
                    nextHero = undefined;
                    try {
                        JSMod.setProgressMode(true);
                    } catch (e) { /* Ignore exception. */ }
                }
            }
        }
        
        function calculateHeroCost(id) {
            var level = getUserData().heroCollection.heroes[id + 1].level;
            return calculateHeroCost(id, level);
        }
        
        function calculateHeroCost(id, level) {
            //debug('dogcog is ' + dogcog);
            //debug('calculateHeroCost level ' + level + ' id ' + id);
            if (!levelCidEnabled && id === 0)
                return Number.MAX_VALUE;
            else if (id === 0 && level <= 15)
                return Math.floor((5 + level) * Math.pow(1.07, level) * dogcog);
            else if (id === 0)
                return Math.floor(20 * Math.pow(1.07, level) * dogcog);
            else
                return Math.floor(baseCosts[id] * Math.pow(1.07, level) * dogcog);
        }
        
        function canPurchaseHero(save, id) {
            var level = save.heroCollection.heroes[id + 1].level;
            return (save.gold > calculateHeroCost(id, level) && (level < getMaxLevel(id) || isGuilded(save.heroCollection.heroes[id + 1])));
        }
        
        function isGuilded(hero) {
            if (hero.epicLevel === 0)
                return false;
            return true;
        }
        
        function buyAllHeroes() {
            var save;
            var heroCosts;
            var canBuyHero = true;
            while (canBuyHero) {
                save = getUserData();
                heroCosts = [];
                for (var i = 0; i < 26; i++)
                    heroCosts[i] = ((save.heroCollection.heroes[i + 1].level < getMaxLevel(save.heroCollection.heroes[i + 1])) ? calculateHeroCost(i, save.heroCollection.heroes[i + 1].level) : Number.MAX_VALUE);
    
                if (save.gold > Math.min.apply(Math, heroCosts)) {
                    JSMod.setZKeyEnabled(true);
                    JSMod.levelHero(heroCosts.indexOf(Math.min.apply(Math, heroCosts)) + 1);
                    JSMod.setZKeyEnabled(false);
                } else
                    canBuyHero = false;
            }
            
        }
        
        function purchaseCheapest() {
            updateDogcog();
            var save = getUserData();
            var heroCosts = [];
            for (var i = 0; i < 26; i++)
                heroCosts[i] = ((save.heroCollection.heroes[i + 1].level < getMaxLevel(save.heroCollection.heroes[i + 1])) ? calculateHeroCost(i, save.heroCollection.heroes[i + 1].level) : Number.MAX_VALUE);

            if (save.gold > Math.min.apply(Math, heroCosts))
                JSMod.levelHero(heroCosts.indexOf(Math.min.apply(Math, heroCosts)) + 1);
        }
        
        function getMaxLevel(hero) {
            return (isGuilded(hero) ? Number.MAX_VALUE : maxLevels[hero.id-1]);
        }
        
        function maxPossibleLevelHero(hero) {
            lastHeroPurchasedTimer = Date.now();
            JSMod.setShiftEnabled(false);
            JSMod.setCtrlEnabled(false);
            JSMod.setZKeyEnabled(false);
            var heroDif = maxLevels[hero.id-1] - hero.level;
            debug('heroDif ' + heroDif);
            if (heroDif >= 100) {
                debug('Control');
                JSMod.setCtrlEnabled(true);
            } else if (heroDif >= 25) {
                debug('Z');
                JSMod.setZKeyEnabled(true);
            } else if (heroDif >= 10){
                debug('Shift');
                JSMod.setZKeyEnabled(true);
            }
            JSMod.levelHero(hero.id);
            JSMod.setShiftEnabled(false);
            JSMod.setCtrlEnabled(false);
            JSMod.setZKeyEnabled(false);
        }
        
        function maxLevelHero(hero) {
            lastHeroPurchasedTimer = Date.now();
            JSMod.setCtrlEnabled(true);
            JSMod.levelHero(hero.id);
            JSMod.setCtrlEnabled(false);
        }
        
        function purchaseHighest() {
            var save = getUserData();
            if (autoBuy) {
                updateDogcog();
                for (var i = 25; i >= 0; i--) {
                    if (canPurchaseHero(save, i))
                        return maxLevelHero(save.heroCollection.heroes[i+1]);
                }
            }
        }
        
        function calculateHeroDps(save, hero, level) {
            if (level === 0)
                return 0;
            return baseDamage[hero.id-1] * hero.damageMultiplier * save.allDpsMultiplier * (1 + (0.5 + 0.02 * getAncientLevel(28)) * hero.epicLevel) * level * (1 + 0.1 * save.heroSouls) + (baseDamage[hero.id-1] * level * hero.damageMultiplier * save.allDpsMultiplier * (1 + (0.5 + 0.2 * getAncientLevel(28)) * hero.epicLevel) *(1 + 0.11 * getAncientLevel(16)));
        }
        
        function calculateEasyHeroDps(save, hero, level) {
            if (level === 0)
                return 0;
            return baseDamage[hero.id-1] * hero.damageMultiplier * save.allDpsMultiplier * (1 + (0.5 + 0.02 * getAncientLevel(28)) * hero.epicLevel) * level * (1 + 0.1 * save.heroSouls);
        }
        
        function getHeroEfficiency(save, hero) {
            // debug('Hero ' + (hero.id - 1) + ' change in dps ' + (calculateEasyHeroDps(save, hero, hero.level + 1) - calculateEasyHeroDps(save, hero, hero.level)) + ' cost ' + calculateHeroCost((hero.id - 1), (hero.level + 1)) + ' efficiency ' + (calculateEasyHeroDps(save, hero, hero.level + 1) - calculateEasyHeroDps(save, hero, hero.level)) / calculateHeroCost((hero.id - 1), (hero.level + 1)));
            // debug('Hero ' + (hero.id - 1) + ' DPS ' + calculateHeroDps(save, hero, hero.level));
            if (hero.id === 1)
                return 0;
            else
                return (calculateEasyHeroDps(save, hero, hero.level + 1) - calculateEasyHeroDps(save, hero, hero.level)) / calculateHeroCost((hero.id - 1), (hero.level + 1));
        }
        
        function hasGoldToPurchaseHero(save, heroID) {
            //debug('hero ' + heroID + ' gold ' + save.gold + ' cost ' + calculateHeroCost(heroID, save.heroCollection.heroes[heroID+1].level + 1));
            return save.gold > calculateHeroCost(heroID, save.heroCollection.heroes[heroID+1].level);
        }
        
        function getMostEfficientHero() {
            if (autoBuy) {
                upgradeAll();
                var save = getUserData();
                var bestHero = [0, 0];
                var tempHero;
                var heroesBelow = [];
                
                for (var i = 0; i < 26; i++) {
                    //debug(save.heroCollection.heroes[i+1]);
                    if (save.heroCollection.heroes[i+1].level < maxLevels[i])
                        heroesBelow.push(i);
                }
                //debug('heroesBelow.length ' + heroesBelow.length);
                if (heroesBelow.length > 0) {
                    if (nextHero === undefined) {
                        for (var i = 0; i < heroesBelow.length; i++) {
                            //debug('heroesBelow[i] ' + heroesBelow[i]);
                            tempHero = [heroesBelow[i], getHeroEfficiency(save, save.heroCollection.heroes[heroesBelow[i]+1])];
                            //debug('Hero ' + i + ' Efficiency: ' + getHeroEfficiency(save, save.heroCollection.heroes[i+1]));
                            if (tempHero[1] > bestHero[1] && !save.heroCollection.heroes[i+1].locked)
                                bestHero = tempHero;
                        }
                        if (hasGoldToPurchaseHero(save, bestHero[0]))
                            maxPossibleLevelHero(save.heroCollection.heroes[bestHero[0]+1]);
                        else
                            nextHero = bestHero[0] + 1;
                    } else {
                        if (save.heroCollection.heroes[nextHero].locked){
                            nextHero = undefined;
                        } else if (hasGoldToPurchaseHero(save, nextHero-1)) {
                            JSMod.levelHero(nextHero);
                            nextHero = undefined;
                        }
                    }
                } else {
                    if (nextHero === undefined) {
                        for (var i = 0; i < 26; i++) {
                            if (!save.heroCollection.heroes[i+1].locked) {
                                tempHero = [i, getHeroEfficiency(save, save.heroCollection.heroes[i+1])];
                                //debug('Hero ' + i + ' Efficiency: ' + getHeroEfficiency(save, save.heroCollection.heroes[i+1]));
                                if (tempHero[1] > bestHero[1])
                                    bestHero = tempHero;
                            }
                        }
                        if (hasGoldToPurchaseHero(save, bestHero[0]))
                            maxLevelHero(save.heroCollection.heroes[bestHero[0]+1]);
                        else
                            nextHero = bestHero[0] + 1;
                    } else {
                        if (hasGoldToPurchaseHero(save, nextHero-1)) {
                            maxLevelHero(save.heroCollection.heroes[nextHero]);
                            nextHero = undefined;
                        }
                    }
                }
                // debug ('Best ' + bestHero[0] + ' next ' + (nextHero-1));
                if ((Date.now() - lastHeroPurchasedTimer) > purchaseTimeout) {
                    buyAllHeroes();
                    lastHeroPurchasedTimer = Date.now();
                }
            }
        }
        
        function updateDogcog() {
            try {
                var temp = dogcog;
                dogcog = (getAncientLevel(11) * 0.02);
                if (dogcog === 0)
                    dogcog = 1;
                if (temp != dogcog)
                    debug("Set dogcog from " + temp + ", to " + dogcog);
            } catch (e) { /* Ignore exception, more than likely not unlocked. */ }
        }
        
        function init() {
            if (window.JSMod === undefined) {
                if (loadAttempts++ < maxAttempts)
                    window.setTimeout(init, loadTimeout / maxAttempts);
                else
                    alert("Failed to load " + App.name + "! Cannot find JSMod object on global scope");
            } else {
                JSMod = window.JSMod;
                JSMod.loadApp(App);
            }
        }
        
        init();
    };
    
    function inject(func) {
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.appendChild(document.createTextNode("(" + func + ")();"));
        $("head").append(script)[0].removeChild(script);
    }
    
    $(inject(main));
})();
