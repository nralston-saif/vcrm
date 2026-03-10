export default function DealDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button skeleton */}
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-6" />

        {/* Header skeleton */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2" />
              <div className="flex gap-2 mt-3">
                <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
                <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Two column layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Company info skeleton */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-2" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mt-2" />
              <div className="grid grid-cols-2 gap-4 mt-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mt-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Founders skeleton */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-2" />
                      <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Votes skeleton */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Deliberation skeleton */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-2" />
              <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse mt-2" />
              <div className="mt-4 flex gap-2">
                <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
