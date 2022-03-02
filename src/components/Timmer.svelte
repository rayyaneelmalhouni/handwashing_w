<script>
  import {createEventDispatcher} from "svelte";
  import PB from "./PB.svelte";
  const dispatch = createEventDispatcher();
  export let finish = true;
  export let time_last = 20;
  export let time = 20;
  function start() {
      if (finish == true) {
        dispatch("end");    
      }
        
  }
</script>
<main>
    
    <PB {time_last} {time}/>
    <button  class="btn" on:click={start} disabled={!finish}>Start</button>
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
    .btn[disabled] {
        background-color: gray;
        cursor: not-allowed;
    }
</style>