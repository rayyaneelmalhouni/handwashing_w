<script>
    export let time_last = 20;
    export let time = 20;
    $: width = (time-time_last) * (100 / time);
</script>

<main>
  <div  class="container">
        <span class="progress-i" style="width: {width}%;"></span>
  </div>
</main>
<style>
    .container {
        margin: 10px 0;
        width: 100%;
        height: 2em;
        border: 1px solid black;
        position: relative;
        border: none;
        background-color: #F9F9F9;
    }
    .progress-i {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 100%;
        background-color: green;
        border: none;
    }
</style>