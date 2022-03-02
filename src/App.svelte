<script>
	import Timmer from './components/Timmer.svelte';
	import HT from './components/HT.svelte';
	const time = 20;
	let audio;
	let time_last = time;
	let finish = true;
	function start_timer() {
		time_last = time;
		finish = false;
		let interval = setInterval(() => {
			time_last -= 1;
			if (time_last === 0) {
				clearInterval(interval);
				audio.play();
				finish = true;
			}
			
		}, 1000);
	}
</script>

<main>
	<div class="container">
		<h1>Handwashing</h1>
		<h3>Time last: 	{time_last}</h3>
		<audio src="sound.wav" bind:this={audio}></audio>
		<Timmer on:end={start_timer} {finish} {time_last} {time}/>
		<HT />	
	</div>
	
</main>

<style>
	
     
	.container {

	   width: 50%;
	   margin: 0 auto;
	   text-align: center;
	   margin-top: 2em;
	   border: 1px solid black;
	   border-radius: 15px;
	   padding: 20px;
   }
</style>