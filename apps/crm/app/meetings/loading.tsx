export default function MeetingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Meetings list skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="h-6 w-64 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2" />
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse mt-4" />
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mt-2" />
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
