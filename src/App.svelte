<script>
	import Timmer from './components/Timmer.svelte';
	import HT from './components/HT.svelte'
</script>

<main>
	<div class="container">
		<h1>Handwashing</h1>
		<h3>Time last: 	20</h3>
		<Timmer />
		<HT />	
	</div>
	
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap');
     * {
		 margin: 0;
		 padding: 0;
		 box-sizing: border-box;
		 font-family: 'Poppins', sans-serif;
	 }
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