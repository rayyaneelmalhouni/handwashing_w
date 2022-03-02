<script>
  import PB from "./PB.svelte";
</script>
<main>
    
    <PB />
    <button class="btn">Start</button>
</main>
<style>
    .btn {
        width: 100%;
        padding:10px;
        background-color: red;
        color: white;
        margin: 10px 0;
        border: none;
        border-radius: 5px;
    }
    .btn:hover {
        background-color: rgb(255, 66, 66);
    }
</style>