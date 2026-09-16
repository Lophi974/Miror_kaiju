export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-5xl text-white mb-8">
        Carte Tokyork
      </h1>

      <div
        aria-label="Carte Tokyork"
        className="grid grid-cols-3 grid-rows-3 gap-6 w-80 h-80 p-4 border"
      >
        <div className="col-start-1 row-start-1 flex items-center justify-center w-16 h-16 bg-red-500 text-white font-bold rounded-full shadow-md">
          A
        </div>

        <div className="col-start-3 row-start-1 flex items-center justify-center w-16 h-16 bg-green-500 text-white font-bold rounded-full shadow-md">
          E
        </div>

        <div className="col-start-1 row-start-2 flex items-center justify-center w-16 h-16 bg-orange-500 text-white font-bold rounded-full shadow-md">
          W
        </div>

        <div className="col-start-2 row-start-2 flex items-center justify-center w-16 h-16 bg-yellow-400 text-gray-800 font-bold rounded-full shadow-md">
          X
        </div>

        <div className="col-start-2 row-start-3 flex items-center justify-center w-16 h-16 bg-blue-400 text-white font-bold rounded-full shadow-md">
          Z
        </div>
      </div>
    </main>
  );
}
