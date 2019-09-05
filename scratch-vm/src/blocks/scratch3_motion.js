const Cast = require('../util/cast');
const MathUtil = require('../util/math-util');
const Timer = require('../util/timer');

const getMonitorIdForBlockWithArgs = require('../util/get-monitor-id');
const Clone = require('../util/clone');
const RenderedTarget = require('../sprites/rendered-target');
const uid = require('../util/uid');
const StageLayering = require('../engine/stage-layering');

const s3Looks = require('./scratch3_looks');
const s3Sens = require('./scratch3_sensing');
const s3Event = require('./scratch3_event');


class Scratch3MotionBlocks {
    constructor(runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        this.Looks = new s3Looks(this.runtime);
        this.Event = new s3Event(this.runtime);
        this.Sens = new s3Sens(this.runtime);

    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives() {
        return {
            motion_movesteps: this.moveSteps,
            motion_gotoxy: this.goToXY,
            motion_goto: this.goTo,
            motion_turnright: this.turnRight,
            motion_turnleft: this.turnLeft,
            motion_pointindirection: this.pointInDirection,
            motion_pointtowards: this.pointTowards,
            motion_glidesecstoxy: this.glide,
            motion_glideto: this.glideTo,
            motion_ifonedgebounce: this.ifOnEdgeBounce,
            motion_setrotationstyle: this.setRotationStyle,
            motion_changexby: this.changeX,
            motion_setx: this.setX,
            motion_changeyby: this.changeY,
            motion_sety: this.setY,
            motion_xposition: this.getX,
            motion_yposition: this.getY,
            motion_direction: this.getDirection,
            motion_movespin: this.moveSpin,
            motion_gridmove: this.gridMove,
            motion_pickobject: this.pickObject,
            motion_right: this.right,
            motion_left: this.left,
            motion_charge: this.charge,
            motion_movetoroom: this.moveToRoom,
            motion_movecat: this.moveCat,
            // Legacy no-op blocks:
            motion_scroll_right: () => {
            },
            motion_scroll_up: () => {
            },
            motion_align_scene: () => {
            },
            motion_xscroll: () => {
            },
            motion_yscroll: () => {
            }
        };
    }

    getMonitored() {
        return {
            motion_xposition: {
                isSpriteSpecific: true,
                getId: targetId => `${targetId}_xposition`
            },
            motion_yposition: {
                isSpriteSpecific: true,
                getId: targetId => `${targetId}_yposition`
            },
            motion_direction: {
                isSpriteSpecific: true,
                getId: targetId => `${targetId}_direction`
            }
        };
    }

    moveSteps(args, util) {
        const steps = Cast.toNumber(args.STEPS);
        const radians = MathUtil.degToRad(90 - util.target.direction);
        const dx = steps * Math.cos(radians);
        const dy = steps * Math.sin(radians);
        util.target.setXY(util.target.x + dx, util.target.y + dy);
    }

    goToXY(args, util) {
        const x = Cast.toNumber(args.X);
        const y = Cast.toNumber(args.Y);
        util.target.setXY(x, y);
    }

    getTargetXY(targetName, util) {
        let targetX = 0;
        let targetY = 0;
        if (targetName === '_mouse_') {
            targetX = util.ioQuery('mouse', 'getScratchX');
            targetY = util.ioQuery('mouse', 'getScratchY');
        } else if (targetName === '_random_') {
            const stageWidth = this.runtime.constructor.STAGE_WIDTH;
            const stageHeight = this.runtime.constructor.STAGE_HEIGHT;
            targetX = Math.round(stageWidth * (Math.random() - 0.5));
            targetY = Math.round(stageHeight * (Math.random() - 0.5));
        } else {
            targetName = Cast.toString(targetName);
            const goToTarget = this.runtime.getSpriteTargetByName(targetName);
            if (!goToTarget) return;
            targetX = goToTarget.x;
            targetY = goToTarget.y;
        }
        return [targetX, targetY];
    }

    goTo(args, util) {
        const targetXY = this.getTargetXY(args.TO, util);
        if (targetXY) {
            util.target.setXY(targetXY[0], targetXY[1]);
        }
    }

    turnRight(args, util) {
        const degrees = Cast.toNumber(args.DEGREES);
        util.target.setDirection(util.target.direction + degrees);
    }

    turnLeft(args, util) {
        const degrees = Cast.toNumber(args.DEGREES);
        util.target.setDirection(util.target.direction - degrees);
    }

    pointInDirection(args, util) {
        const direction = Cast.toNumber(args.DIRECTION);
        util.target.setDirection(direction);
    }

    pointTowards(args, util) {
        let targetX = 0;
        let targetY = 0;
        if (args.TOWARDS === '_mouse_') {
            targetX = util.ioQuery('mouse', 'getScratchX');
            targetY = util.ioQuery('mouse', 'getScratchY');
        } else if (args.TOWARDS === '_random_') {
            util.target.setDirection(Math.round(Math.random() * 360) - 180);
            return;
        } else {
            args.TOWARDS = Cast.toString(args.TOWARDS);
            const pointTarget = this.runtime.getSpriteTargetByName(args.TOWARDS);
            if (!pointTarget) return;
            targetX = pointTarget.x;
            targetY = pointTarget.y;
        }

        const dx = targetX - util.target.x;
        const dy = targetY - util.target.y;
        const direction = 90 - MathUtil.radToDeg(Math.atan2(dy, dx));
        util.target.setDirection(direction);
    }

    glide(args, util) {
        if (util.stackFrame.timer) {
            const timeElapsed = util.stackFrame.timer.timeElapsed();
            if (timeElapsed < util.stackFrame.duration * 1000) {
                // In progress: move to intermediate position.
                const frac = timeElapsed / (util.stackFrame.duration * 1000);
                const dx = frac * (util.stackFrame.endX - util.stackFrame.startX);
                const dy = frac * (util.stackFrame.endY - util.stackFrame.startY);
                util.target.setXY(
                    util.stackFrame.startX + dx,
                    util.stackFrame.startY + dy
                );
                util.yield();
            } else {
                // Finished: move to final position.
                util.target.setXY(util.stackFrame.endX, util.stackFrame.endY);
            }
        } else {
            // First time: save data for future use.
            util.stackFrame.timer = new Timer();
            util.stackFrame.timer.start();
            util.stackFrame.duration = Cast.toNumber(args.SECS);
            util.stackFrame.startX = util.target.x;
            util.stackFrame.startY = util.target.y;
            util.stackFrame.endX = Cast.toNumber(args.X);
            util.stackFrame.endY = Cast.toNumber(args.Y);
            if (util.stackFrame.duration <= 0) {
                // Duration too short to glide.
                util.target.setXY(util.stackFrame.endX, util.stackFrame.endY);
                return;
            }
            util.yield();
        }
    }

    glideTo(args, util) {
        const targetXY = this.getTargetXY(args.TO, util);
        if (targetXY) {
            this.glide({SECS: args.SECS, X: targetXY[0], Y: targetXY[1]}, util);
        }
    }

    ifOnEdgeBounce(args, util) {
        const bounds = util.target.getBounds();
        if (!bounds) {
            return;
        }
        // Measure distance to edges.
        // Values are positive when the sprite is far away,
        // and clamped to zero when the sprite is beyond.
        const stageWidth = this.runtime.constructor.STAGE_WIDTH;
        const stageHeight = this.runtime.constructor.STAGE_HEIGHT;
        const distLeft = Math.max(0, (stageWidth / 2) + bounds.left);
        const distTop = Math.max(0, (stageHeight / 2) - bounds.top);
        const distRight = Math.max(0, (stageWidth / 2) - bounds.right);
        const distBottom = Math.max(0, (stageHeight / 2) + bounds.bottom);
        // Find the nearest edge.
        let nearestEdge = '';
        let minDist = Infinity;
        if (distLeft < minDist) {
            minDist = distLeft;
            nearestEdge = 'left';
        }
        if (distTop < minDist) {
            minDist = distTop;
            nearestEdge = 'top';
        }
        if (distRight < minDist) {
            minDist = distRight;
            nearestEdge = 'right';
        }
        if (distBottom < minDist) {
            minDist = distBottom;
            nearestEdge = 'bottom';
        }
        if (minDist > 0) {
            return; // Not touching any edge.
        }
        // Point away from the nearest edge.
        const radians = MathUtil.degToRad(90 - util.target.direction);
        let dx = Math.cos(radians);
        let dy = -Math.sin(radians);
        if (nearestEdge === 'left') {
            dx = Math.max(0.2, Math.abs(dx));
        } else if (nearestEdge === 'top') {
            dy = Math.max(0.2, Math.abs(dy));
        } else if (nearestEdge === 'right') {
            dx = 0 - Math.max(0.2, Math.abs(dx));
        } else if (nearestEdge === 'bottom') {
            dy = 0 - Math.max(0.2, Math.abs(dy));
        }
        const newDirection = MathUtil.radToDeg(Math.atan2(dy, dx)) + 90;
        util.target.setDirection(newDirection);
        // Keep within the stage.
        const fencedPosition = util.target.keepInFence(util.target.x, util.target.y);
        util.target.setXY(fencedPosition[0], fencedPosition[1]);
    }

    setRotationStyle(args, util) {
        util.target.setRotationStyle(args.STYLE);
    }

    changeX(args, util) {
        const dx = Cast.toNumber(args.DX);
        util.target.setXY(util.target.x + dx, util.target.y);
    }

    setX(args, util) {
        const x = Cast.toNumber(args.X);
        util.target.setXY(x, util.target.y);
    }

    changeY(args, util) {
        const dy = Cast.toNumber(args.DY);
        util.target.setXY(util.target.x, util.target.y + dy);
    }

    setY(args, util) {
        const y = Cast.toNumber(args.Y);
        util.target.setXY(util.target.x, y);
    }

    getX(args, util) {
        return this.limitPrecision(util.target.x);
    }

    getY(args, util) {
        return this.limitPrecision(util.target.y);
    }

    getDirection(args, util) {
        return util.target.direction;
    }

    // This corresponds to snapToInteger in Scratch 2
    limitPrecision(coordinate) {
        const rounded = Math.round(coordinate);
        const delta = coordinate - rounded;
        const limitedCoord = (Math.abs(delta) < 1e-9) ? rounded : coordinate;

        return limitedCoord;
    }

    moveSpin(args, util) {
        const steps = Cast.toNumber(args.STEPS * 100);
        const radians = MathUtil.degToRad(90 - util.target.direction);
        const dx = steps * Math.cos(radians);
        const dy = steps * Math.sin(radians);
        const direction = util.target.direction;
        util.target.setXY(util.target.x + dx, util.target.y + dy);
        util.target.setDirection(90 - direction);
    }

    gridMove(args, util) {
        if (typeof util.stackFrame.loopCounter === 'undefined') {
            const squares = Cast.toNumber(args.STEPS);
            util.stackFrame.loopCounter = squares;
        }


        const red = {COLOR: '#FF0000'};
        const green = {COLOR: '#49BC00'};
        const blue = {COLOR: '#0010F5'};

        if (util.stackFrame.loopCounter <= 0) {
            return;
        }

        if (typeof util.stackFrame.index === 'undefined') {
            util.stackFrame.index = 0;
        }


        //let Sens = new s3Sens(this.runtime);

        if (this.Sens.touchingColor(red, util) || this.Sens.touchingColor(blue, util) || this.Sens.touchingColor(green, util)) {
            //let Looks = new s3Looks(this.runtime);
            this.Looks.sayforsecs({MESSAGE: 'Cant go there. Retry!', SECS: 3}, util);
            if (util.stackTimerNeedsInit()) {
                const duration = 3000;
                util.startStackTimer(duration);
                this.runtime.requestRedraw();
                util.yield();
            } else if (!util.stackTimerFinished()) {
                util.yield();
            } else {
                util.stopAll();
            }
        } else if (util.stackFrame.index < 47) {
            util.stackFrame.index++;
            this.moveSteps({STEPS: 1}, util);
            util.yield();
        } else {
            this.moveSteps({STEPS: 1}, util);
            util.stackFrame.loopCounter--;
            util.stackFrame.index = 0;
            util.yield();
        }


    }

    pickObject(args, util) {

        //let Sens = new s3Sens(this.runtime);

        if (this.Sens.touchingObject({TOUCHINGOBJECTMENU: 'news'}, util)) {
            //let Event = new s3Event(this.runtime);
            //Event.broadcast({BROADCAST_OPTION.name: 'pick_up', BROADCAST_OPTION.id: 'j(bq%qx3[]JbP+2aWaM_'}, util);
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: 'pick_up'
            });
            //let Looks = new s3Looks(this.runtime);
            this.Looks.sayforsecs({MESSAGE: 'Picked up the newspaper', SECS: 3}, util);
        } else {
            //let Looks = new s3Looks(this.runtime);
            this.Looks.sayforsecs({MESSAGE: 'I cant pick up a newspaper here.', SECS: 3}, util);
        }


    }

    right(args, util) {
        const degrees = 90;
        util.target.setDirection(util.target.direction + degrees);
    }

    left(args, util) {
        const degrees = 90;
        util.target.setDirection(util.target.direction - degrees);
    }

    charge (args, util) {
        if (util.stackTimerNeedsInit() && this.Sens.touchingObject({TOUCHINGOBJECTMENU: 'charging station'}, util)) {
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: 'charging'
            });
            //this.Looks.sayforsecs({MESSAGE: 'Charging..', SECS: 2}, util);

            //this.Control.wait({DURATION: '5'}, util);
        } else if (util.stackTimerNeedsInit()){
            this.Looks.sayforsecs({MESSAGE: 'I am not at my charging station.', SECS: 5}, util);
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: 'startpos'
            });
        }

        if (util.stackTimerNeedsInit()) {
            const duration = Math.max(0, 1000 * 0.5);

            util.startStackTimer(duration);
            console.log("Init wait time");
            this.runtime.requestRedraw();
            util.yield();
        } else if (!util.stackTimerFinished()) {
            console.log("Waiting tick");
            util.yield();
        }
        // this.Control.wait({DURATION: '5'}, util);
        // util.startHats('event_whenbroadcastreceived', {
        //      BROADCAST_OPTION: 'charged'
        //  });
    }

    moveCat (args, util){
        /*console.log("The cat variable:");
        console.log(util.target.lookupVariableByNameAndType('cat_present', ''));
        console.log(Cast.toNumber(util.target.lookupVariableByNameAndType('cat_present', '').value));
        console.log("All the variables:");
        console.log(util.target.getAllVariableNamesInScopeByType(''));
*/
        if (Cast.toNumber(util.target.lookupVariableByNameAndType('cat_present', '').value) && (util.target.x == 1 || util.target.x == 108) && util.target.y == 143){
            const message1 = 'laser';
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: message1
            });
            console.log('msg: ', message1);
        }
        else {
            this.Looks.sayforsecs({MESSAGE: 'Tried to move the cat but it was no cat there... Retry!', SECS: 5}, util);
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: 'startpos'
            });
        }
    }

    moveToRoom (args, util){
        const goTarget = args.DESTINATION;
        const currPos = [util.target.x, util.target.y];

        const Hall = 'Hall';
        const Kitch = 'Kitch';
        const Bed = 'Bed';
        const Liv = 'Liv';

        // Have we run before, starting threads?
        if (!util.stackFrame.startedThreads) {
            // No - start hats for this broadcast.

            if (goTarget == 'Hallway') {
                if (currPos[0] < 9 && currPos[1] > -8){
                    //In the Kitchen
                    const message1 = `${goTarget}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);

                } else if (currPos[0] > 43 && currPos[1] > 90){
                    //In the Hallway
                    const message1 = `${goTarget}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                }
                else{
                    this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Hallway from here directly.', SECS: 3}, util);
                }
            } else if (goTarget == 'Kitchen') {
                if(currPos[0] > 43 && currPos[1] > 90){
                    //In the Hallway
                    const message1 = `${goTarget}_${Hall}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                }
                else if (currPos[0] > 43 && currPos[1] < 62){
                    //In the Bed room
                    const message1 = `${goTarget}_${Bed}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                }
                else if (currPos[0] < 10 && currPos[1] < -34){
                    //In the Living room
                    const message1 = `${goTarget}_${Liv}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);

                    /*
                    console.log(currPos);
                    if(currPos[0] != KitchenXY[0] && currPos[1] != BedXY[1] && this.nextAction == 0) {
                        console.log("first move action");
                        console.log(this.nextAction);
                        this.glide({SECS: 2, X: KitchenXY[0], Y: BedXY[1]}, util);
                        util.yield();
                    }
                    else if (currPos[0] == KitchenXY[0] && currPos[1] == BedXY[1] && this.nextAction == 0){
                        console.log("Changing value of nextAction...");
                        this.runtime.requestRedraw();
                        this.nextAction = 1;
                        util.yield();
                    }
                    else if (currPos[0] == KitchenXY[0] && currPos[1] == KitchenXY[1] && this.nextAction == 1){
                        console.log("Finished");
                        return;
                    }
                    else if (this.nextAction == 1) {
                        console.log("Came to the right place");
                        console.log(this.nextAction);
                        //this.stopAll();
                        this.glide({SECS: 2, X: KitchenXY[0], Y: KitchenXY[1]}, util);

                        console.log("Passed the right action");
                        util.yield();
                    } */
                }
                else{
                    this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Kitchen from here directly.', SECS: 3}, util);
                }

            } else if (goTarget == 'Bed Room') {
                if (currPos[0] < 9 && currPos[1] > -8) {
                    //In the Kitchen
                    const message1 = `${goTarget}_${Kitch}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                } else if (currPos[0] < 10 && currPos[1] < -34) {
                    //In the Living room
                    const message1 = `${goTarget}_${Liv}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                } else {
                    this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Bed Room from here directly.', SECS: 3}, util);
                }
            }
            else if (goTarget == 'Living Room') {
                if(currPos[0] < 9 && currPos[1] > -8){
                    //In the Kitchen
                    const message1 = `${goTarget}_${Kitch}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                }
                else if (currPos[0] > 43 && currPos[1] < 62){
                    // In the Bed room
                    const message1 = `${goTarget}_${Bed}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                }
                else{
                    this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Living Room from here directly.', SECS: 3}, util);
                }
            }
            else if (goTarget =='Charging'){
                if(currPos[0] > 43 && currPos[1] > 90){
                    //In the Hallway
                    const message1 = `${goTarget}_${Hall}`;
                    util.stackFrame.startedThreads = util.startHats('event_whenbroadcastreceived', {
                        BROADCAST_OPTION: message1
                    });
                    console.log('msg: ', message1);
                }
                else{
                    this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Charging Station from here directly.', SECS: 3}, util);
                }
            }
            else{
                console.log("No correct input");
                console.log(goTarget);
            }


            if (typeof util.stackFrame.startedThreads === 'undefined') {
                // Nothing was started.
                return;
            }
            else if (util.stackFrame.startedThreads.length === 0){
                return;
            }
        }
        // We've run before; check if the wait is still going on.
        const instance = this;
        // Scratch 2 considers threads to be waiting if they are still in
        // runtime.threads. Threads that have run all their blocks, or are
        // marked done but still in runtime.threads are still considered to
        // be waiting.
        const waiting = util.stackFrame.startedThreads
            .some(thread => instance.runtime.threads.indexOf(thread) !== -1);
        if (waiting) {
            // If all threads are waiting for the next tick or later yield
            // for a tick as well. Otherwise yield until the next loop of
            // the threads.
            if (
                util.stackFrame.startedThreads
                    .every(thread => instance.runtime.isWaitingThread(thread))
            ) {
                util.yieldTick();
            } else {
                util.yield();
            }
        }

    }


    moveToRoom1 (args, util) {
        console.log('HI');
        /*
        if(typeof this.nextAction === 'undefined') {
            this.nextAction = 0;
        }
        */
        const goTarget = Cast.toString(args.DESTINATION);
        const currPos = [util.target.x, util.target.y];
        /*
        const HallwayXY = [121,142];
        const KitchenXY = [-2,50];
        const LivingXY = [-92,-140];
        const BedXY = [142, -91];
        */
        const Hall = 'Hall';
        const Kitch = 'Kitch';
        const Bed = 'Bed';
        const Liv = 'Liv';

        if (goTarget == 'Hallway') {
            if (currPos[0] < 9 && currPos[1] > -8){
                //In the Kitchen
                const message1 = `${goTarget}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);

            }
            else{
                this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Hallway from here directly.', SECS: 3}, util);
            }
        } else if (goTarget == 'Kitchen') {
            if(currPos[0] > 43 && currPos[1] > 90){
                //In the Hallway
                const message1 = `${goTarget}_${Hall}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            }
            else if (currPos[0] > 43 && currPos[1] < 62){
                //In the Bed room
                const message1 = `${goTarget}_${Bed}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            }
            else if (currPos[0] < 10 && currPos[1] < -34){
                //In the Living room
                const message1 = `${goTarget}_${Liv}`;
                const broadcast = {BROADCAST_OPTION: {id: "|gt]r-X8OFi=^V_U:LUy",
                name: message1}};
                this.Event.broadcastAndWait(broadcast, util);
                //util.startHats('event_whenbroadcastreceived', {
                //    BROADCAST_OPTION: message1
                //});
                console.log('msg: ', message1);

                /*
                console.log(currPos);
                if(currPos[0] != KitchenXY[0] && currPos[1] != BedXY[1] && this.nextAction == 0) {
                    console.log("first move action");
                    console.log(this.nextAction);
                    this.glide({SECS: 2, X: KitchenXY[0], Y: BedXY[1]}, util);
                    util.yield();
                }
                else if (currPos[0] == KitchenXY[0] && currPos[1] == BedXY[1] && this.nextAction == 0){
                    console.log("Changing value of nextAction...");
                    this.runtime.requestRedraw();
                    this.nextAction = 1;
                    util.yield();
                }
                else if (currPos[0] == KitchenXY[0] && currPos[1] == KitchenXY[1] && this.nextAction == 1){
                    console.log("Finished");
                    return;
                }
                else if (this.nextAction == 1) {
                    console.log("Came to the right place");
                    console.log(this.nextAction);
                    //this.stopAll();
                    this.glide({SECS: 2, X: KitchenXY[0], Y: KitchenXY[1]}, util);

                    console.log("Passed the right action");
                    util.yield();
                } */
            }
            else{
                this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Kitchen from here directly.', SECS: 3}, util);
            }

        } else if (goTarget == 'Bed Room') {
            if (currPos[0] < 9 && currPos[1] > -8) {
                //In the Kitchen
                const message1 = `${goTarget}_${Kitch}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            } else if (currPos[0] < 10 && currPos[1] < -34) {
                //In the Living room
                const message1 = `${goTarget}_${Liv}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            } else {
                this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Bed Room from here directly.', SECS: 3}, util);
            }
        }
        else if (goTarget == 'Living Room') {
            if(currPos[0] < 9 && currPos[1] > -8){
                //In the Kitchen
                const message1 = `${goTarget}_${Kich}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            }
            else if (currPos[0] > 43 && currPos[1] < 62){
                // In the Bed room
                const message1 = `${goTarget}_${Bed}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            }
            else{
                this.Looks.sayforsecs({MESSAGE: 'I cannot go to the Living Room from here directly.', SECS: 3}, util);
            }
        }
        else if (goTarget =='Charging'){
            if(currPos[0] > 43 && currPos[1] > 90){
                //In the Hallway
                const message1 = `${goTarget}_${Hall}`;
                util.startHats('event_whenbroadcastreceived', {
                    BROADCAST_OPTION: message1
                });
                console.log('msg: ', message1);
            }
        }
        else{
            console.log("No correct input");
            console.log(goTarget);
        }
        if (!goTarget) return 0;
    }

/*
    moveRoom(args, util) {
        console.log('HI');

        let goTarget;


        if (args.OBJECT != args.PROPERTY) {
            pickTarget = Cast.toString(args.PROPERTY);
            placeTarget = Cast.toString(args.OBJECT);
            // pickTarget = this.runtime.getSpriteTargetByName(args.PROPERTY);
            // placeTarget = this.runtime.getSpriteTargetByName(args.OBJECT);
            console.log('put this: ', args.PROPERTY);
            console.log('on: ', placeTarget);
            const message1 = `${pickTarget}_${placeTarget}`;
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: message1
            });
            console.log('msg: ', message1);
        } else {
            console.log('same object');
            this.Looks.sayforsecs({MESSAGE: 'I cannot stack object onto themselves.', SECS: 3}, util);
        }
        if (!pickTarget) return 0;
        if (!placeTarget) return 0;
    }*/
}

module.exports = Scratch3MotionBlocks;
