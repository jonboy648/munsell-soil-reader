// What leaves the phone. Always: one check for a new version of the app. Only when a project has
// location turned on and the user taps: the position, to two public services. Later: one more thing.
import { NotYet, Section, Sub } from "./parts"

export function LeavesPhoneSection() {
  return (
    <Section id="privacy" title="What leaves your phone">
      <p>
        <b>Your Photos and Readings never leave it.</b> They are read in the app on your phone and
        are never uploaded. There are no accounts and no cloud copy.
      </p>
      <p>
        The app does one thing with the network. It asks soil.joncackler.com, which is hosted on
        GitHub Pages, for its own files: on your first visit, and then each time you open it, bring
        it back to the front or get signal again, to see whether a new version is out. That request
        carries no Photo and no Reading, only what any web request carries: your network address and
        your browser's name. Between those, the app works with no signal.
      </p>
      <Sub>Only when you turn on location for a project</Sub>
      <div data-testid="leaves-lookups" className="grid gap-2">
        <p>
          Location is off for every project until you turn it on in that project. While it is off,
          that project's sampling points never ask the phone for its position and send no request but
          the one above. Once it is on, nothing happens until you tap a button on a sampling point:
        </p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>
            <b>Use my location</b> reads the phone's position (latitude and longitude, WGS84) and
            writes it on the point. With a signal, the same tap then sends that position to the two
            services below; with no signal nothing is sent. <b>Look up this position</b> does the
            same look-ups for the position already on the point, without reading the phone again.
          </li>
          <li>
            <b>Look-ups by location.</b> With a signal, the point's position is sent to two public
            services that need no account: the USDA NRCS Soil Data Access service (the Soil Map Unit
            Name) and the US Fish and Wildlife Service National Wetlands Inventory map service (the
            NWI classification). Each sees the position and your network address, and nothing else:
            no Photo, no Reading, no project or point name. With no signal, the lookup says it is
            unavailable and the two fields stay for you to type.
          </li>
        </ul>
        <p>
          What comes back is yours to edit, and what you type is never replaced by a later look-up.
          A value an earlier look-up wrote is removed when the position changes and the new place
          has none.
        </p>
      </div>
      <Sub>The Log's own location switch</Sub>
      <p data-testid="leaves-log-location">
        Separate from projects: in the Log, the save sheet has "Save my location with this
        Sample", off until you switch it on. When it is on, each save reads the phone's position
        and keeps it with that Sample in the Log on your phone. It is sent nowhere, and it is in a
        file only if you export the Log.
      </p>
      <NotYet testId="leaves-stub">
        <p>
          One more thing is planned that would send data off the phone. It will happen only when you
          ask for it, it will be off or hidden until then, and it will be listed here before it
          ships.
        </p>
        <ul className="grid list-disc gap-1 pl-5">
          <li>
            <b>Plant photo identification.</b> One plant photo, the one you pick, goes to an
            identification service, and the best matches come back for you to choose from. It is
            hidden when you are offline, and no photo is sent without your tap.
          </li>
        </ul>
      </NotYet>
    </Section>
  )
}
