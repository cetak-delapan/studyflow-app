export default function StatCard({

title,

value,

icon

}){


return(

<div className="
bg-white
p-6
rounded-2xl
shadow-sm
hover:shadow-md
transition
">


<div className="
text-4xl
">

{icon}

</div>




<h3 className="
text-gray-500
mt-4
text-sm
font-medium
">

{title}

</h3>




<p className="
text-4xl
font-bold
mt-2
text-gray-800
">

{value}

</p>




</div>

)

}