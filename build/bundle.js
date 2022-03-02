var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\components\PB.svelte generated by Svelte v3.46.4 */

    function create_fragment$3(ctx) {
    	let main;
    	let div;
    	let span;

    	return {
    		c() {
    			main = element("main");
    			div = element("div");
    			span = element("span");
    			attr(span, "class", "progress-i svelte-1vq40qs");
    			set_style(span, "width", /*width*/ ctx[0] + "%");
    			attr(div, "class", "container svelte-1vq40qs");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div);
    			append(div, span);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*width*/ 1) {
    				set_style(span, "width", /*width*/ ctx[0] + "%");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let width;
    	let { time_last = 20 } = $$props;
    	let { time = 20 } = $$props;

    	$$self.$$set = $$props => {
    		if ('time_last' in $$props) $$invalidate(1, time_last = $$props.time_last);
    		if ('time' in $$props) $$invalidate(2, time = $$props.time);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*time, time_last*/ 6) {
    			$$invalidate(0, width = (time - time_last) * (100 / time));
    		}
    	};

    	return [width, time_last, time];
    }

    class PB extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, { time_last: 1, time: 2 });
    	}
    }

    /* src\components\Timmer.svelte generated by Svelte v3.46.4 */

    function create_fragment$2(ctx) {
    	let main;
    	let pb;
    	let t0;
    	let button;
    	let t1;
    	let button_disabled_value;
    	let current;
    	let mounted;
    	let dispose;

    	pb = new PB({
    			props: {
    				time_last: /*time_last*/ ctx[1],
    				time: /*time*/ ctx[2]
    			}
    		});

    	return {
    		c() {
    			main = element("main");
    			create_component(pb.$$.fragment);
    			t0 = space();
    			button = element("button");
    			t1 = text("Start");
    			attr(button, "class", "btn svelte-u7fqpw");
    			button.disabled = button_disabled_value = !/*finish*/ ctx[0];
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			mount_component(pb, main, null);
    			append(main, t0);
    			append(main, button);
    			append(button, t1);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*start*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			const pb_changes = {};
    			if (dirty & /*time_last*/ 2) pb_changes.time_last = /*time_last*/ ctx[1];
    			if (dirty & /*time*/ 4) pb_changes.time = /*time*/ ctx[2];
    			pb.$set(pb_changes);

    			if (!current || dirty & /*finish*/ 1 && button_disabled_value !== (button_disabled_value = !/*finish*/ ctx[0])) {
    				button.disabled = button_disabled_value;
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(pb.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(pb.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(pb);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { finish = true } = $$props;
    	let { time_last = 20 } = $$props;
    	let { time = 20 } = $$props;

    	function start() {
    		if (finish == true) {
    			dispatch("end");
    		}
    	}

    	$$self.$$set = $$props => {
    		if ('finish' in $$props) $$invalidate(0, finish = $$props.finish);
    		if ('time_last' in $$props) $$invalidate(1, time_last = $$props.time_last);
    		if ('time' in $$props) $$invalidate(2, time = $$props.time);
    	};

    	return [finish, time_last, time, start];
    }

    class Timmer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, { finish: 0, time_last: 1, time: 2 });
    	}
    }

    /* src\components\HT.svelte generated by Svelte v3.46.4 */

    function create_fragment$1(ctx) {
    	let main;

    	return {
    		c() {
    			main = element("main");
    			main.innerHTML = `<img class="ht-img svelte-1qzzeh1" src="./handwashing.gif" alt="handwashing image"/>`;
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    		}
    	};
    }

    class HT extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.4 */

    function create_fragment(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let h3;
    	let t2;
    	let t3;
    	let t4;
    	let audio_1;
    	let audio_1_src_value;
    	let t5;
    	let timmer;
    	let t6;
    	let ht;
    	let current;

    	timmer = new Timmer({
    			props: {
    				finish: /*finish*/ ctx[2],
    				time_last: /*time_last*/ ctx[1],
    				time
    			}
    		});

    	timmer.$on("end", /*start_timer*/ ctx[3]);
    	ht = new HT({});

    	return {
    		c() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Handwashing";
    			t1 = space();
    			h3 = element("h3");
    			t2 = text("Time last: \t");
    			t3 = text(/*time_last*/ ctx[1]);
    			t4 = space();
    			audio_1 = element("audio");
    			t5 = space();
    			create_component(timmer.$$.fragment);
    			t6 = space();
    			create_component(ht.$$.fragment);
    			if (!src_url_equal(audio_1.src, audio_1_src_value = "sound.wav")) attr(audio_1, "src", audio_1_src_value);
    			attr(div, "class", "container svelte-1572r4c");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div);
    			append(div, h1);
    			append(div, t1);
    			append(div, h3);
    			append(h3, t2);
    			append(h3, t3);
    			append(div, t4);
    			append(div, audio_1);
    			/*audio_1_binding*/ ctx[4](audio_1);
    			append(div, t5);
    			mount_component(timmer, div, null);
    			append(div, t6);
    			mount_component(ht, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*time_last*/ 2) set_data(t3, /*time_last*/ ctx[1]);
    			const timmer_changes = {};
    			if (dirty & /*finish*/ 4) timmer_changes.finish = /*finish*/ ctx[2];
    			if (dirty & /*time_last*/ 2) timmer_changes.time_last = /*time_last*/ ctx[1];
    			timmer.$set(timmer_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(timmer.$$.fragment, local);
    			transition_in(ht.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(timmer.$$.fragment, local);
    			transition_out(ht.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			/*audio_1_binding*/ ctx[4](null);
    			destroy_component(timmer);
    			destroy_component(ht);
    		}
    	};
    }

    const time = 20;

    function instance($$self, $$props, $$invalidate) {
    	let audio;
    	let time_last = time;
    	let finish = true;

    	function start_timer() {
    		$$invalidate(1, time_last = time);
    		$$invalidate(2, finish = false);

    		let interval = setInterval(
    			() => {
    				$$invalidate(1, time_last -= 1);

    				if (time_last === 0) {
    					clearInterval(interval);
    					audio.play();
    					$$invalidate(2, finish = true);
    				}
    			},
    			1000
    		);
    	}

    	function audio_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			audio = $$value;
    			$$invalidate(0, audio);
    		});
    	}

    	return [audio, time_last, finish, start_timer, audio_1_binding];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
      target: document.body,
      props: {},
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
